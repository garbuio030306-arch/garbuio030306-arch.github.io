// Pure, dependency-free graph metrics computed from data/edges.json.
// Used by the Network view, the Rankings panel, and the Heatmap.
// Everything here is a function of `edges` (and optionally `nodeIds`) — nothing is hard-coded,
// so editing data/edges.json and reloading the page changes every number downstream.

(function (global) {
  'use strict';

  function filterEdges(edges, includeProposed) {
    return includeProposed ? edges : edges.filter(e => e.provenance === 'notes');
  }

  function uniqueNodeIds(edges) {
    const s = new Set();
    edges.forEach(e => { s.add(e.source); s.add(e.target); });
    return Array.from(s);
  }

  // A. Inbound / outbound / total degree
  function computeDegrees(edges, nodeIds) {
    const ids = nodeIds || uniqueNodeIds(edges);
    const inbound = {}, outbound = {};
    ids.forEach(id => { inbound[id] = 0; outbound[id] = 0; });
    edges.forEach(e => {
      if (outbound[e.source] === undefined) outbound[e.source] = 0;
      if (inbound[e.target] === undefined) inbound[e.target] = 0;
      outbound[e.source] += 1;
      inbound[e.target] += 1;
    });
    const result = {};
    ids.forEach(id => {
      result[id] = {
        inbound: inbound[id] || 0,
        outbound: outbound[id] || 0,
        total: (inbound[id] || 0) + (outbound[id] || 0)
      };
    });
    return result;
  }

  // PageRank (standard power iteration, damping 0.85), directed as given.
  // Nodes with no outbound edges (dangling) redistribute their mass uniformly — standard fix.
  function computePageRank(edges, nodeIds, opts) {
    opts = opts || {};
    const damping = opts.damping !== undefined ? opts.damping : 0.85;
    const maxIter = opts.maxIter || 200;
    const tol = opts.tol || 1e-10;
    const ids = nodeIds || uniqueNodeIds(edges);
    const n = ids.length;
    if (n === 0) return {};

    const outEdges = {};
    ids.forEach(id => { outEdges[id] = []; });
    edges.forEach(e => {
      if (!outEdges[e.source]) outEdges[e.source] = [];
      outEdges[e.source].push(e.target);
    });

    let pr = {};
    ids.forEach(id => { pr[id] = 1 / n; });

    for (let iter = 0; iter < maxIter; iter++) {
      let danglingMass = 0;
      ids.forEach(id => {
        if (outEdges[id].length === 0) danglingMass += pr[id];
      });

      const next = {};
      ids.forEach(id => { next[id] = (1 - damping) / n + damping * danglingMass / n; });

      ids.forEach(id => {
        const outs = outEdges[id];
        if (outs.length === 0) return;
        const share = damping * pr[id] / outs.length;
        outs.forEach(target => {
          if (next[target] === undefined) next[target] = (1 - damping) / n;
          next[target] += share;
        });
      });

      let diff = 0;
      ids.forEach(id => { diff += Math.abs((next[id] || 0) - pr[id]); });
      pr = next;
      if (diff < tol) break;
    }
    return pr;
  }

  // Betweenness centrality via Brandes' algorithm, treating edges as directed.
  function computeBetweenness(edges, nodeIds) {
    const ids = nodeIds || uniqueNodeIds(edges);
    const adj = {};
    ids.forEach(id => { adj[id] = []; });
    edges.forEach(e => {
      if (!adj[e.source]) adj[e.source] = [];
      adj[e.source].push(e.target);
    });

    const CB = {};
    ids.forEach(id => { CB[id] = 0; });

    ids.forEach(s => {
      const stack = [];
      const pred = {};
      const sigma = {};
      const dist = {};
      ids.forEach(id => { pred[id] = []; sigma[id] = 0; dist[id] = -1; });
      sigma[s] = 1;
      dist[s] = 0;
      const queue = [s];

      while (queue.length) {
        const v = queue.shift();
        stack.push(v);
        (adj[v] || []).forEach(w => {
          if (dist[w] < 0) {
            dist[w] = dist[v] + 1;
            queue.push(w);
          }
          if (dist[w] === dist[v] + 1) {
            sigma[w] += sigma[v];
            pred[w].push(v);
          }
        });
      }

      const delta = {};
      ids.forEach(id => { delta[id] = 0; });
      while (stack.length) {
        const w = stack.pop();
        pred[w].forEach(v => {
          delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        });
        if (w !== s) CB[w] += delta[w];
      }
    });

    return CB;
  }

  // B. Factors ranked by number of distinct real estate segments they hit.
  // Takes factors.json-style array with a `segmentsHit` array of segment ids per factor.
  function computeFactorSegmentCounts(factors) {
    const result = {};
    factors.forEach(f => {
      result[f.id] = Array.isArray(f.segmentsHit) ? f.segmentsHit.length : 0;
    });
    return result;
  }

  // C. Segments ranked by number of factors hitting them (inverse of B).
  function computeSegmentFactorCounts(factors, segmentIds) {
    const result = {};
    (segmentIds || []).forEach(id => { result[id] = 0; });
    factors.forEach(f => {
      (f.segmentsHit || []).forEach(segId => {
        result[segId] = (result[segId] || 0) + 1;
      });
    });
    return result;
  }

  // D. Mutual (bidirectional) pairs.
  function computeMutualPairs(edges, includeProposed) {
    const es = filterEdges(edges, includeProposed);
    const set = new Set(es.map(e => e.source + '->' + e.target));
    const pairs = [];
    const seen = new Set();
    es.forEach(e => {
      const reverse = e.target + '->' + e.source;
      const key = [e.source, e.target].sort().join('|');
      if (set.has(reverse) && !seen.has(key)) {
        seen.add(key);
        pairs.push([e.source, e.target]);
      }
    });
    return pairs;
  }

  function fullReport(edges, nodeIds, includeProposed) {
    const es = filterEdges(edges, includeProposed);
    const ids = nodeIds || uniqueNodeIds(edges);
    return {
      degrees: computeDegrees(es, ids),
      pagerank: computePageRank(es, ids),
      betweenness: computeBetweenness(es, ids),
      mutualPairs: computeMutualPairs(edges, includeProposed),
      totalOutbound: es.length
    };
  }

  const GraphMetrics = {
    filterEdges,
    uniqueNodeIds,
    computeDegrees,
    computePageRank,
    computeBetweenness,
    computeFactorSegmentCounts,
    computeSegmentFactorCounts,
    computeMutualPairs,
    fullReport
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphMetrics;
  } else {
    global.GraphMetrics = GraphMetrics;
  }
})(typeof window !== 'undefined' ? window : globalThis);
