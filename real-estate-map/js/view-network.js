// View 3: Interconnection Network -- force-directed graph + rankings panel (computed via GraphMetrics).
(function () {
  'use strict';

  let includeProposed = false;
  let sortKey = 'inbound';
  let sortDir = 'desc';

  function render(DATA, hierarchyData, filters) {
    const container = document.getElementById('view-network');

    const about = AboutView.render(
      'About this view',
      'The 10 factors that drive the thesis (Rates, Credit, Inflation, and so on), shown as a map of what affects what. Bigger circle = more connected = watch it closely.',
      [
        { label: 'Each circle', detail: 'One factor. Same 10 factors as "Macro Factors" in Full Picture, just a different view of them.' },
        { label: 'Circle size', detail: 'How many links it has to other factors. Bigger = more connected.' },
        { label: 'Line between circles', detail: 'One factor affects the other, in the direction of the arrow.' },
        { label: 'Solid vs dashed line', detail: 'Solid = from the research. Dashed = our own guess, since the notes didn\'t say (only for Rates and Inflation). Turn these on/off with the checkbox above.' },
        { label: 'Click a circle', detail: 'Shows what it\'s connected to, and what happens in different scenarios for it.' },
        { label: 'Drag a circle', detail: 'Just moves it around. Doesn\'t change any numbers.' },
        { label: 'Zoom', detail: 'Scroll or pinch over the map to zoom in and out, drag the empty background to move around, or use the + and − buttons.' },
        { label: 'Panel on the right', detail: 'The same connections, as a sortable table and a few simple rankings.' }
      ]
    );

    container.innerHTML = `
      ${about}
      <div class="controls-row">
        <label class="chip-toggle"><input type="checkbox" id="net-include-proposed"> Include "proposed" edges</label>
        <div class="zoom-btns" role="group" aria-label="Zoom">
          <button class="icon-btn" id="net-zoom-in" aria-label="Zoom in">+</button>
          <button class="icon-btn" id="net-zoom-out" aria-label="Zoom out">−</button>
          <button class="icon-btn" id="net-zoom-reset">Reset zoom</button>
        </div>
        <div class="legend">
          <span class="legend-item"><span class="legend-swatch notes"></span>notes link</span>
          <span class="legend-item" style="color:var(--prov-proposed);">┄┄ proposed link</span>
        </div>
      </div>
      <div class="network-layout">
        <div class="network-svg-wrap"><svg class="network-svg" id="net-svg"></svg></div>
        <div class="network-side">
          <div id="net-scenario-panel"></div>
          <div id="net-rankings"></div>
        </div>
      </div>
    `;

    document.getElementById('net-include-proposed').checked = includeProposed;
    document.getElementById('net-include-proposed').addEventListener('change', (e) => {
      includeProposed = e.target.checked;
      render(DATA, hierarchyData, filters);
    });

    const zoom = drawGraph(DATA, filters);
    const netSvg = d3.select('#net-svg');
    document.getElementById('net-zoom-in').addEventListener('click', () => netSvg.transition().duration(250).call(zoom.scaleBy, 1.4));
    document.getElementById('net-zoom-out').addEventListener('click', () => netSvg.transition().duration(250).call(zoom.scaleBy, 1 / 1.4));
    document.getElementById('net-zoom-reset').addEventListener('click', () => netSvg.transition().duration(300).call(zoom.transform, d3.zoomIdentity));
    drawRankings(DATA);
    document.getElementById('net-scenario-panel').innerHTML = '<p class="empty-state">Click a node to see its scenario table.</p>';
  }

  function drawGraph(DATA, filters) {
    const allEdges = DATA.edges.edges;
    const edges = includeProposed ? allEdges : allEdges.filter(e => e.provenance === 'notes');
    const nodeIds = GraphMetrics.uniqueNodeIds(allEdges);
    const degrees = GraphMetrics.computeDegrees(edges, nodeIds);

    const wrap = document.getElementById('net-svg').parentElement;
    const width = Math.max(420, wrap.clientWidth || 500);
    const height = 520;
    const svg = d3.select('#net-svg').attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

    const nodes = nodeIds.map(id => ({ id, name: DataLoader.factorName(id, DATA), degree: degrees[id].total || 1 }));
    const links = edges.map(e => ({ source: e.source, target: e.target, provenance: e.provenance }));

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(d => 14 + d.degree * 1.5));

    // Everything drawn goes in one layer that d3.zoom transforms (wheel, pinch, background drag).
    const layer = svg.append('g');
    const zoom = d3.zoom()
      .scaleExtent([0.4, 6])
      .on('zoom', (event) => layer.attr('transform', event.transform));
    svg.call(zoom).on('dblclick.zoom', null);

    const linkSel = layer.append('g').selectAll('line')
      .data(links).join('line')
      .attr('class', d => 'link' + (d.provenance === 'proposed' ? ' proposed' : ''))
      .attr('stroke-width', 1.2);

    const nodeG = layer.append('g').selectAll('g')
      .data(nodes).join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    nodeG.append('circle')
      .attr('r', d => 10 + d.degree * 1.8)
      .attr('fill', 'var(--prov-notes)')
      .attr('fill-opacity', 0.75);

    nodeG.append('text').attr('dy', d => -(13 + d.degree * 1.8)).attr('text-anchor', 'middle').text(d => d.name.split(' ')[0]);

    nodeG.on('click', (event, d) => {
      event.stopPropagation();
      highlightNode(d.id, links, nodeG, linkSel);
      showScenarioPanel(d.id, DATA);
    });

    svg.on('click', () => { nodeG.classed('dim', false); linkSel.classed('highlighted', false); });

    sim.on('tick', () => {
      linkSel.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    return zoom;
  }

  function highlightNode(id, links, nodeG, linkSel) {
    const neighbours = new Set([id]);
    links.forEach(l => {
      const s = l.source.id || l.source, t = l.target.id || l.target;
      if (s === id) neighbours.add(t);
      if (t === id) neighbours.add(s);
    });
    nodeG.classed('dim', d => !neighbours.has(d.id));
    linkSel.classed('highlighted', l => (l.source.id || l.source) === id || (l.target.id || l.target) === id);
  }

  function showScenarioPanel(factorId, DATA) {
    const f = DATA.factors.factors.find(x => x.id === factorId);
    const panel = document.getElementById('net-scenario-panel');
    if (!f) { panel.innerHTML = ''; return; }
    let html = `<h3>${DetailPanel.esc(f.name)} ${DetailPanel.badge(f.provenance)}</h3>`;
    html += `<button class="icon-btn" id="net-open-detail" style="margin-bottom:8px;">Open full card →</button>`;
    html += DetailPanel.table(['Scenario','What happens','Helped','Hurt','Net read'], (f.scenarios || []).map(s => [s.scenario, s.whatHappens, s.helped, s.hurt, s.netRead]));
    panel.innerHTML = html;
    document.getElementById('net-open-detail').addEventListener('click', () => DetailPanel.show({ source: 'factor', id: factorId }, DATA));
  }

  function drawRankings(DATA) {
    const allEdges = DATA.edges.edges;
    const nodeIds = GraphMetrics.uniqueNodeIds(allEdges);
    const edges = includeProposed ? allEdges : allEdges.filter(e => e.provenance === 'notes');
    const degrees = GraphMetrics.computeDegrees(edges, nodeIds);
    const pr = GraphMetrics.computePageRank(edges, nodeIds);
    const bw = GraphMetrics.computeBetweenness(edges, nodeIds);
    const mutual = GraphMetrics.computeMutualPairs(allEdges, includeProposed);

    const maxInbound = Math.max(...nodeIds.map(id => degrees[id].inbound), 1);
    const rows = nodeIds.map(id => ({ id, name: DataLoader.factorName(id, DATA), ...degrees[id], pagerank: pr[id], betweenness: bw[id] }));

    function sortRows() {
      return [...rows].sort((a, b) => (sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    }

    const panel = document.getElementById('net-rankings');
    function renderTable() {
      const sorted = sortRows();
      panel.innerHTML = `
        <h3>A. Ranked factors ${includeProposed ? '(notes + proposed)' : '(notes only)'}</h3>
        <p class="rank-subtitle">Which factors matter most. Click a column to sort by it.</p>
        <p style="font-size:11.5px;color:var(--text-muted);">Total links shown: ${edges.length}${!includeProposed ? ' (matches your count of 45)' : ''}</p>
        <table class="rank-table" id="rank-table">
          <thead><tr>
            <th data-key="name">Factor</th>
            <th data-key="inbound" title="How many other factors affect this one">In</th>
            <th data-key="outbound" title="How many other factors this one affects">Out</th>
            <th data-key="total" title="In + Out">Total</th>
            <th data-key="pagerank" title="How important this factor is, counting its connections' connections too">PageRank</th>
            <th data-key="betweenness" title="How often this factor sits between two others, like a bridge">Betweenness</th>
          </tr></thead>
          <tbody>${sorted.map(r => `
            <tr>
              <td>${DetailPanel.esc(r.name)}</td>
              <td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${(r.inbound/maxInbound*100).toFixed(0)}%"></div></div>${r.inbound}</div></td>
              <td>${r.outbound}</td>
              <td>${r.total}</td>
              <td>${r.pagerank.toFixed(3)}</td>
              <td>${r.betweenness.toFixed(2)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <h3>B. Factors by segments hit</h3>
        <p class="rank-subtitle">How many real estate segments each factor touches, from most to least (see the Heatmap view for details).</p>
        <div id="rank-b"></div>
        <h3>D. Two-way pairs</h3>
        <p class="rank-subtitle">Factors that each affect the other -- the strongest relationships.</p>
        <p style="font-size:12.5px;">${mutual.length ? mutual.map(p => `${DataLoader.factorName(p[0],DATA)} ↔ ${DataLoader.factorName(p[1],DATA)}`).join('<br>') : 'None'}</p>
      `;
      Array.from(panel.querySelectorAll('#rank-table th')).forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.key;
          if (key === sortKey) sortDir = sortDir === 'desc' ? 'asc' : 'desc'; else { sortKey = key; sortDir = 'desc'; }
          renderTable();
        });
      });

      const segCounts = GraphMetrics.computeFactorSegmentCounts(DATA.factors.factors);
      const maxSeg = Math.max(...Object.values(segCounts), 1);
      const segRows = DATA.factors.factors.map(f => ({ name: f.name, count: segCounts[f.id] })).sort((a,b) => b.count - a.count);
      document.getElementById('rank-b').innerHTML = `<table class="rank-table"><tbody>${segRows.map(r => `
        <tr><td>${DetailPanel.esc(r.name)}</td><td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${(r.count/maxSeg*100).toFixed(0)}%"></div></div>${r.count}</div></td></tr>`).join('')}</tbody></table>`;
    }
    renderTable();
  }

  window.ViewNetwork = { render };
})();
