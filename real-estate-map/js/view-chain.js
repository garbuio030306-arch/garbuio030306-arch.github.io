// View 2: Vertical Value Chain -- the Real Estate value chain, top to bottom, with supporting sectors as a side rail.
(function () {
  'use strict';

  function stagePasses(stage, filters) {
    if (filters.hideAdded && stage.provenance === 'added') return false;
    if (filters.hideProposed && stage.provenance === 'proposed') return false;
    return true;
  }

  function renderChainColumn(chain, DATA, filters) {
    const stages = chain.stages.filter(s => stagePasses(s, filters));
    let html = `<h2>${DetailPanel.esc(chain.name)}</h2><div class="chain-flow" id="chain-flow-${chain.id}">`;
    stages.forEach((s, i) => {
      const isCurrent = chain.currentResearchStageId === s.id;
      html += `<div class="chain-stage${isCurrent ? ' current-focus' : ''}" data-stage="${s.id}" data-chain="${chain.id}" tabindex="0" role="button">
        ${isCurrent ? '<span class="focus-tag">YOUR RESEARCH IS HERE</span>' : ''}
        <strong>${DetailPanel.esc(s.name)}</strong> ${DetailPanel.badge(s.provenance)}
        <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">${DetailPanel.esc((s.examples||[]).join(', '))}</div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;">Rate sensitivity: ${DetailPanel.esc(s.rateSensitivity)}</div>
      </div>`;
      if (i < stages.length - 1) html += '<div class="chain-arrow">↓</div>';
    });
    html += '</div>';
    return html;
  }

  function renderRail(chain, DATA, filters) {
    const sectors = (chain.supportingSectors || []).filter(s => stagePasses(s, filters));
    if (!sectors.length) return '';
    let html = `<div class="chain-rail"><h3>Supporting sectors</h3>`;
    sectors.forEach(s => {
      html += `<div class="rail-item" data-sector="${s.id}" data-chain="${chain.id}" tabindex="0" role="button">
        <strong>${DetailPanel.esc(s.name)}</strong> ${DetailPanel.badge(s.provenance)}
        <div style="color:var(--text-muted);margin-top:2px;">${DetailPanel.esc((s.examples||[]).join(', '))}</div>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  function render(DATA, hierarchyData, filters) {
    const container = document.getElementById('view-chain');
    const re = DATA.chains.chains.find(c => c.id === 'real_estate_vertical');

    const about = AboutView.render(
      'About this view',
      'How a building gets made and owned, step by step -- from raw materials to the people managing the finished property.',
      [
        { label: 'Each card', detail: 'One step, in order. Top is first (raw materials), bottom is last (managing finished buildings).' },
        { label: 'Rate sensitivity line', detail: 'How much that step is affected by interest rates, from Low to Very High.' },
        { label: 'Blue box', detail: '"Real estate ownership" -- where this research is focused right now.' },
        { label: 'Supporting sectors', detail: 'Sectors that help every step, like banks and insurers, shown on the side instead of in the main list.' },
        { label: 'Click a card', detail: 'See more detail about it.' }
      ]
    );

    container.innerHTML = `
      ${about}
      <div class="chain-layout" id="chain-layout">
        <div style="min-width:300px; max-width:620px;">${renderChainColumn(re, DATA, filters)}</div>
        ${renderRail(re, DATA, filters)}
      </div>
    `;

    container.querySelectorAll('[data-stage]').forEach(el => {
      el.addEventListener('click', () => DetailPanel.show({ source: 'chainStage', chainId: el.dataset.chain, stageId: el.dataset.stage }, DATA));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    });
    container.querySelectorAll('[data-sector]').forEach(el => {
      el.addEventListener('click', () => DetailPanel.show({ source: 'chainSupport', chainId: el.dataset.chain, sectorId: el.dataset.sector }, DATA));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    });
  }

  window.ViewChain = { render };
})();
