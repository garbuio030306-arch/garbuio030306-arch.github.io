// View 4: Factor x Segment heatmap -- rows=factors, cols=segments, filled if factor.segmentsHit includes segment.
(function () {
  'use strict';

  let rowSort = 'default';
  let colSort = 'default';

  function render(DATA, hierarchyData, filters) {
    const container = document.getElementById('view-heatmap');
    let factors = DATA.factors.factors;
    let segments = DATA.segments.segments.filter(s => {
      if (filters.hideAdded && s.provenance === 'added') return false;
      if (filters.hideProposed && s.provenance === 'proposed') return false;
      return true;
    });

    const rowTotals = GraphMetrics.computeFactorSegmentCounts(factors);
    const colTotals = GraphMetrics.computeSegmentFactorCounts(factors, segments.map(s => s.id));

    let rows = [...factors];
    let cols = [...segments];
    if (rowSort === 'total') rows.sort((a, b) => rowTotals[b.id] - rowTotals[a.id]);
    if (colSort === 'total') cols.sort((a, b) => colTotals[b.id] - colTotals[a.id]);

    const about = AboutView.render(
      'About this view',
      'A grid showing which factors affect which parts of real estate.',
      [
        { label: 'Rows', detail: 'The 10 factors.' },
        { label: 'Columns', detail: 'Real estate segments -- office, retail, logistics, homebuilders, and so on.' },
        { label: 'Filled cell', detail: 'The research says this factor affects this segment. An empty cell just means it wasn\'t mentioned, not that there\'s no effect.' },
        { label: 'Numbers in headers', detail: 'How many segments a factor hits, or how many factors hit a segment. Click a header to sort by it.' },
        { label: 'Click a cell or header', detail: 'See more detail.' }
      ]
    );

    container.innerHTML = `
      ${about}
      <div class="controls-row">
        <p style="margin:0;font-size:12.5px;color:var(--text-muted);">Click a header to sort by total.</p>
        <div class="spacer"></div>
        <button class="icon-btn" id="hm-row-sort">Sort rows by total</button>
        <button class="icon-btn" id="hm-col-sort">Sort columns by total</button>
      </div>
      <div class="heatmap-wrap">
        <table class="heatmap">
          <thead><tr>
            <th class="corner"></th>
            ${cols.map(c => `<th class="col-head" data-col="${c.id}" title="${DetailPanel.esc(c.name)}">${DetailPanel.esc(c.name.length > 14 ? c.name.slice(0,13)+'…' : c.name)}<div class="heatmap-total">${colTotals[c.id]}</div></th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows.map(f => `
              <tr>
                <th class="row-head" data-row="${f.id}">${DetailPanel.esc(f.name)} <span class="heatmap-total">(${rowTotals[f.id]})</span></th>
                ${cols.map(c => {
                  const hit = (f.segmentsHit || []).includes(c.id);
                  return `<td class="cell${hit ? ' hit' : ''}" data-factor="${f.id}" data-segment="${c.id}" title="${DetailPanel.esc(f.name)} × ${DetailPanel.esc(c.name)}: ${hit ? 'hit' : 'not hit'}"></td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('hm-row-sort').addEventListener('click', () => { rowSort = rowSort === 'total' ? 'default' : 'total'; render(DATA, hierarchyData, filters); });
    document.getElementById('hm-col-sort').addEventListener('click', () => { colSort = colSort === 'total' ? 'default' : 'total'; render(DATA, hierarchyData, filters); });

    container.querySelectorAll('.cell.hit').forEach(td => {
      td.addEventListener('click', () => DetailPanel.show({ source: 'segment', id: td.dataset.segment }, DATA));
    });
    container.querySelectorAll('.row-head').forEach(th => {
      th.addEventListener('click', () => DetailPanel.show({ source: 'factor', id: th.dataset.row }, DATA));
    });
    container.querySelectorAll('.col-head').forEach(th => {
      th.addEventListener('click', (e) => {
        if (e.target === th || th.contains(e.target)) DetailPanel.show({ source: 'segment', id: th.dataset.col }, DATA);
      });
    });
  }

  window.ViewHeatmap = { render };
})();
