// Shared "About this view" explainer card, shown at the top of every view.
// rows: array of {label, detail} describing what's on screen, what size/color/lines mean, and how to interact.
(function (global) {
  'use strict';

  function render(title, blurb, rows) {
    const rowsHtml = rows.map(r => `
      <tr>
        <th>${DetailPanel.esc(r.label)}</th>
        <td>${r.detail}</td>
      </tr>`).join('');
    return `
      <details class="about-view" open>
        <summary>
          <span class="about-view-icon" aria-hidden="true">ⓘ</span>
          <span class="about-view-title">${DetailPanel.esc(title)}</span>
          <span class="about-view-toggle-hint when-open">hide</span><span class="about-view-toggle-hint when-closed">show</span>
        </summary>
        <div class="about-view-body">
          ${blurb ? `<p class="about-view-blurb">${blurb}</p>` : ''}
          <table class="about-table"><tbody>${rowsHtml}</tbody></table>
        </div>
      </details>
    `;
  }

  global.AboutView = { render };
})(window);
