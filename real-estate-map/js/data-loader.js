// Loads all data/*.json and assembles the Full-Picture hierarchy live.
// Nothing here is cached/hard-coded beyond this session's fetch -- edit a data file,
// reload the page, and every view (rankings, heatmap, network, tree) reflects it.

(function (global) {
  'use strict';

  async function loadAll() {
    const files = ['nodes', 'edges', 'factors', 'segments', 'chains', 'picks'];
    const results = await Promise.all(files.map(f => fetch(`data/${f}.json`).then(r => {
      if (!r.ok) throw new Error(`Failed to load data/${f}.json (${r.status})`);
      return r.json();
    })));
    const DATA = {};
    files.forEach((f, i) => { DATA[f] = results[i]; });
    return DATA;
  }

  function factorName(id, DATA) {
    const f = (DATA.factors.factors || []).find(x => x.id === id);
    return f ? f.name : id;
  }

  function segmentName(id, DATA) {
    const s = (DATA.segments.segments || []).find(x => x.id === id);
    return s ? s.name : id;
  }

  // Build children for a chain category (real_estate_vertical)
  function chainChildren(chainId, DATA) {
    const chain = DATA.chains.chains.find(c => c.id === chainId);
    if (!chain) return [];
    const stageNodes = chain.stages.map(s => ({
      id: 'stage_' + s.id,
      name: s.name,
      type: 'leaf',
      provenance: s.provenance,
      source: s.source,
      value: 3,
      detailRef: { source: 'chainStage', chainId: chainId, stageId: s.id }
    }));
    if (chain.supportingSectors && chain.supportingSectors.length) {
      stageNodes.push({
        id: chainId + '_supporting',
        name: 'Supporting sectors',
        type: 'subcategory',
        children: chain.supportingSectors.map(s => ({
          id: 'sup_' + s.id,
          name: s.name,
          type: 'leaf',
          provenance: s.provenance,
          source: s.source,
          value: 2,
          detailRef: { source: 'chainSupport', chainId: chainId, sectorId: s.id }
        }))
      });
    }
    return stageNodes;
  }

  function factorsChildren(DATA) {
    return DATA.factors.factors.map(f => ({
      id: 'factor_' + f.id,
      name: f.name,
      type: 'leaf',
      provenance: f.provenance,
      source: (f.sourcePages || []).length ? `research.pdf p.${f.sourcePages.join(',')}` : '',
      value: 4,
      detailRef: { source: 'factor', id: f.id }
    }));
  }

  function segmentsChildren(DATA) {
    const byCategory = {};
    DATA.segments.segments.forEach(s => {
      const cat = s.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(s);
    });
    const catLabels = { 'primary-sector': 'Primary sectors', 'sub-sector': 'Sub-sectors', 'business-model': 'Business-model / REIT type' };
    return Object.keys(byCategory).map(cat => ({
      id: 'segcat_' + cat,
      name: catLabels[cat] || cat,
      type: 'subcategory',
      children: byCategory[cat].map(s => ({
        id: 'segment_' + s.id,
        name: s.name,
        type: 'leaf',
        provenance: s.provenance,
        source: s.source,
        value: 2 + (s.rateSensitivity && s.rateSensitivity.score10 ? s.rateSensitivity.score10 / 3 : 1),
        sensitivity: s.rateSensitivity,
        detailRef: { source: 'segment', id: s.id }
      }))
    }));
  }

  function picksChildren(DATA) {
    const p = DATA.picks;
    return [
      {
        id: 'picks_stocks', name: 'Stocks', type: 'subcategory',
        children: p.stocks.map(s => ({ id: 'stock_' + s.id, name: s.name, type: 'leaf', provenance: s.provenance, source: s.source, value: 4, detailRef: { source: 'stock', id: s.id } }))
      },
      {
        id: 'picks_funds', name: 'Funds', type: 'subcategory',
        children: p.funds.map(f => ({ id: 'fund_' + f.id, name: f.name, type: 'leaf', provenance: f.provenance, source: f.source, value: 3, detailRef: { source: 'fund', id: f.id } }))
      },
      {
        id: 'picks_etfs', name: 'ETFs', type: 'subcategory',
        children: p.etfs.map(e => ({ id: 'etf_' + e.id, name: e.name, type: 'leaf', provenance: e.provenance, source: e.source, value: 3, detailRef: { source: 'etf', id: e.id } }))
      }
    ];
  }

  function assembleHierarchy(DATA) {
    const root = {
      id: DATA.nodes.root.id,
      name: DATA.nodes.root.name,
      type: 'root',
      children: DATA.nodes.categories.map(cat => {
        let children;
        if (cat.childSource === 'inline') {
          children = cat.children.map(c => ({ ...c, type: 'leaf', value: 3, detailRef: { source: 'thesisInline', id: c.id } }));
        } else if (cat.childSource.startsWith('chains:')) {
          children = chainChildren(cat.childSource.split(':')[1], DATA);
        } else if (cat.childSource === 'factors') {
          children = factorsChildren(DATA);
        } else if (cat.childSource === 'segments') {
          children = segmentsChildren(DATA);
        } else if (cat.childSource === 'picks') {
          children = picksChildren(DATA);
        } else {
          children = [];
        }
        return {
          id: cat.id,
          name: cat.name,
          type: 'category',
          color: cat.color,
          children
        };
      })
    };
    return root;
  }

  global.DataLoader = { loadAll, assembleHierarchy, factorName, segmentName };
})(window);
