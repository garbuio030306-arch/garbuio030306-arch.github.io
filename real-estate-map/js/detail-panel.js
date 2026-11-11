// Shared right-hand detail panel. Every view calls DetailPanel.show(detailRef, DATA)
// so a leaf's full card (source, provenance, scenarios, current-situation etc.) renders consistently everywhere.

(function (global) {
  'use strict';

  function esc(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function badge(prov) {
    if (!prov) return '';
    return `<span class="prov-badge ${esc(prov)}">${esc(prov)}</span>`;
  }

  function table(headers, rows) {
    if (!rows || !rows.length) return '<p class="empty-state" style="padding:4px 0;">No data yet.</p>';
    let html = '<table class="detail-table"><thead><tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach(r => { html += '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>'; });
    html += '</tbody></table>';
    return html;
  }

  function section(title, html) {
    if (!html) return '';
    return `<div class="detail-section"><h4>${esc(title)}</h4>${html}</div>`;
  }

  function renderFactor(id, DATA) {
    const f = DATA.factors.factors.find(x => x.id === id);
    if (!f) return '<p>Not found.</p>';
    const links = DATA.edges.edges.filter(e => e.source === id);
    const linksHtml = links.length ? '<ul style="padding-left:18px;font-size:12.5px;">' + links.map(l => `<li>${badge(l.provenance)} -&gt; ${esc(DataLoader.factorName(l.target, DATA))}${l.rationale ? ' -- ' + esc(l.rationale) : ''}</li>`).join('') + '</ul>' : '<p class="empty-state">None in notes.</p>';
    let html = `<h2>${badge(f.provenance)} ${esc(f.name)}</h2>`;
    html += section('Why it matters', `<p>${esc(f.whyItMatters)}</p>`);
    if (f.direction) html += section('Direction', `<p><b>Up:</b> ${esc(f.direction.up)}</p><p><b>Down:</b> ${esc(f.direction.down)}</p>`);
    html += section('Backdrop needed', f.backdrop ? `<p>${esc(f.backdrop)}</p>` : '');
    html += section('Example', f.example ? `<p>${esc(f.example)}</p>` : '');
    html += section('Links to other factors', linksHtml);
    if (f.reitMechanics) html += section('REIT mechanics', f.reitMechanics.map(m => `<div class="watchout-item"><b>${esc(m.reason)}</b>${esc(m.detail)}</div>`).join(''));
    if (f.homebuilderMechanics) html += section('Homebuilder mechanics', f.homebuilderMechanics.map(m => `<div class="watchout-item"><b>${esc(m.reason)}</b>${esc(m.detail)}</div>`).join(''));
    if (f.watchouts) html += section('Watch-outs', f.watchouts.map(w => `<div class="watchout-item"><b>${esc(w.title)}</b>${esc(w.detail)}</div>`).join(''));
    if (f.ltvDefinitionFlag) html += section('⚠ Flag', `<p>${esc(f.ltvDefinitionFlag)}</p>`);
    if (f.indicators && (f.indicators.list || []).length) html += section('Indicators to watch', `<p>${esc((f.indicators.list||[]).join(', '))}</p><p class="source-line">${esc(f.indicators.sources||'')}</p>`);
    if (f.scenarios && f.scenarios.length) html += section('Scenarios', table(['Scenario','What happens','Helped','Hurt','Net read'], f.scenarios.map(s => [s.scenario, s.whatHappens, s.helped, s.hurt, s.netRead])));
    const curUSA = (f.currentSituation && f.currentSituation.USA) || [];
    const curEU = (f.currentSituation && f.currentSituation.EU) || [];
    html += section('Current situation -- USA', table(['Indicator','Situation'], curUSA.map(c => [c.indicator, c.situation || '(empty in notes)'])));
    html += section('Current situation -- EU', table(['Indicator','Situation'], curEU.map(c => [c.indicator, c.situation || '(empty in notes)'])));
    html += `<p class="source-line">Source: ${esc((f.sourcePages||[]).length ? 'research.pdf p.' + f.sourcePages.join(', ') : 'see notes')}</p>`;
    return html;
  }

  function renderSegment(id, DATA) {
    const s = DATA.segments.segments.find(x => x.id === id);
    if (!s) return '<p>Not found.</p>';
    const hittingFactors = DATA.factors.factors.filter(f => (f.segmentsHit || []).includes(id));
    let html = `<h2>${badge(s.provenance)} ${esc(s.name)}</h2>`;
    html += section('Rate sensitivity', `<p>Qualitative: <b>${esc(s.rateSensitivity.qualitative)}</b>${s.rateSensitivity.score10 != null ? ` &middot; Score: <b>${esc(s.rateSensitivity.score10)}/10</b>` : ''}</p>`);
    if (s.rateWhy) html += section('Why rates hit it this way', `<p>${badge(s.rateWhy.provenance)} ${esc(s.rateWhy.text)}</p><p class="source-line">Source: ${esc(s.rateWhy.source)}</p>`);
    html += section('Description', `<p>${esc(s.description)}</p>`);
    html += section('Drivers', `<p>${esc((s.drivers||[]).join(', '))}</p>`);
    html += section('Hit by factors', hittingFactors.length ? '<ul style="padding-left:18px;font-size:12.5px;">' + hittingFactors.map(f => `<li>${esc(f.name)}</li>`).join('') + '</ul>' : '<p class="empty-state">None mapped.</p>');
    html += `<p class="source-line">Source: ${esc(s.source)}</p>`;
    return html;
  }

  function renderChainStage(chainId, stageId, DATA) {
    const chain = DATA.chains.chains.find(c => c.id === chainId);
    const stage = chain.stages.find(s => s.id === stageId);
    let html = `<h2>${badge(stage.provenance)} ${esc(stage.name)}${chain.currentResearchStageId === stageId ? ' <span class="prov-badge notes">YOUR RESEARCH IS HERE</span>' : ''}</h2>`;
    html += section('Examples', `<p>${esc((stage.examples||[]).join(', '))}</p>`);
    html += section('Rate sensitivity', `<p>${esc(stage.rateSensitivity)}</p>`);
    html += section('Main drivers', `<p>${esc((stage.mainDrivers||[]).join(', '))}</p>`);
    html += section('Linked macro factors', (stage.linkedFactors||[]).map(fid => `<span class="prov-badge notes" style="margin:2px;">${esc(DataLoader.factorName(fid, DATA))}</span>`).join(''));
    html += `<p class="source-line">Source: ${esc(stage.source)}${stage.sourceDate ? ' (' + esc(stage.sourceDate) + ')' : ''}</p>`;
    return html;
  }

  function renderChainSupport(chainId, sectorId, DATA) {
    const chain = DATA.chains.chains.find(c => c.id === chainId);
    const s = chain.supportingSectors.find(x => x.id === sectorId);
    let html = `<h2>${badge(s.provenance)} ${esc(s.name)}</h2>`;
    html += section('Examples', `<p>${esc((s.examples||[]).join(', '))}</p>`);
    html += section('Serves stages', `<p>${esc((s.servesStages||[]).join(', '))}</p>`);
    html += section('Rate sensitivity', `<p>${esc(s.rateSensitivity)}</p>`);
    html += section('Linked macro factors', (s.linkedFactors||[]).map(fid => `<span class="prov-badge notes" style="margin:2px;">${esc(DataLoader.factorName(fid, DATA))}</span>`).join(''));
    html += `<p class="source-line">Source: ${esc(s.source)}</p>`;
    return html;
  }

  function renderStock(id, DATA) {
    const s = DATA.picks.stocks.find(x => x.id === id);
    let html = `<h2>${badge(s.provenance)} ${esc(s.name)}</h2>`;
    if (s.aka) html += `<p class="source-line">${esc(s.aka)}</p>`;
    html += `<p>Ticker: <b>${esc(s.ticker)}</b></p>`;
    if (s.flag) html += section('⚠ Flag', `<p>${esc(s.flag)}</p>`);
    const fc = s.fundamentals || {};
    html += section('Fundamentals card', `
      <p><b>Business:</b> ${esc(fc.business || '(TODO)')}</p>
      <p><b>Leverage / LTV:</b> ${esc(fc.leverageLTV || '(TODO)')}</p>
      <p><b>Debt maturity profile:</b> ${esc(fc.debtMaturityProfile || '(TODO)')}</p>
      <p><b>Discount to NAV:</b> ${esc(fc.discountToNAV || '(TODO)')}</p>
      <p><b>Key risk:</b> ${esc(fc.keyRisk || '(TODO)')}</p>
      ${fc.note ? `<p class="source-line">${esc(fc.note)}</p>` : ''}
      <p class="source-line" style="margin-top:8px;">Research organisation only -- not investment advice, no price targets or recommendations.</p>
    `);
    html += `<p class="source-line">Source: ${esc(s.source)}</p>`;
    return html;
  }

  function renderFund(id, DATA) {
    const f = DATA.picks.funds.find(x => x.id === id);
    let html = `<h2>${badge(f.provenance)} ${esc(f.name)}</h2>`;
    html += `<p>Fund manager: <b>${esc(f.fundManager || '(not stated)')}</b>${f.fundManagerProvenance ? ' ' + badge(f.fundManagerProvenance) : ''}</p>`;
    if (f.flag) html += section('⚠ Flag', `<p>${esc(f.flag)}</p>`);
    html += `<p class="source-line">Source: ${esc(f.source)}</p>`;
    return html;
  }

  function renderEtf(id, DATA) {
    const e = DATA.picks.etfs.find(x => x.id === id);
    let html = `<h2>${badge(e.provenance)} ${esc(e.name)}</h2>`;
    if (e.fullName) html += `<p>${esc(e.fullName)}</p>`;
    if (e.flag) html += section('⚠ Flag', `<p>${esc(e.flag)}</p>`);
    html += `<p class="source-line">Source: ${esc(e.source)}</p>`;
    return html;
  }

  function renderThesisInline(id, DATA) {
    const c = DATA.nodes.categories.find(cat => cat.id === 'thesis').children.find(x => x.id === id);
    let html = `<h2>${badge(c.provenance)} ${esc(c.name)}</h2>`;
    html += `<p>${esc(c.detail)}</p>`;
    html += `<p class="source-line">Source: ${esc(c.source)}</p>`;
    return html;
  }

  function show(detailRef, DATA) {
    const panel = document.getElementById('detail-panel');
    const body = document.getElementById('detail-panel-body');
    let html = '<p>Not found.</p>';
    try {
      switch (detailRef.source) {
        case 'factor': html = renderFactor(detailRef.id, DATA); break;
        case 'segment': html = renderSegment(detailRef.id, DATA); break;
        case 'chainStage': html = renderChainStage(detailRef.chainId, detailRef.stageId, DATA); break;
        case 'chainSupport': html = renderChainSupport(detailRef.chainId, detailRef.sectorId, DATA); break;
        case 'stock': html = renderStock(detailRef.id, DATA); break;
        case 'fund': html = renderFund(detailRef.id, DATA); break;
        case 'etf': html = renderEtf(detailRef.id, DATA); break;
        case 'thesisInline': html = renderThesisInline(detailRef.id, DATA); break;
      }
    } catch (e) {
      html = `<p>Error rendering detail: ${esc(e.message)}</p>`;
    }
    body.innerHTML = `<button class="close-btn" aria-label="Close" onclick="DetailPanel.close()">&times;</button>` + html;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  }

  function close() {
    const panel = document.getElementById('detail-panel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  global.DetailPanel = { show, close, esc, badge, table, section };
})(window);
