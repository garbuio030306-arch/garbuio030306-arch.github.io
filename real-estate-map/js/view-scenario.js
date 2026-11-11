// View 5: Scenario Explorer -- pick factor + scenario -> helped/hurt/net read, plus cycle lead/lag notes.
(function () {
  'use strict';

  function render(DATA, hierarchyData, filters) {
    const container = document.getElementById('view-scenario');
    const factors = DATA.factors.factors.filter(f => (f.scenarios || []).length);

    const about = AboutView.render(
      'About this view',
      'Pick a factor and a "what if" to see what happens.',
      [
        { label: 'First dropdown', detail: 'Pick a factor.' },
        { label: 'Second dropdown', detail: 'Pick a scenario for it, like "Inflation falls" or "Credit tightens".' },
        { label: 'What happens / Helped / Hurt', detail: 'The direct effect, and who wins or loses.' },
        { label: 'Net read for thesis', detail: 'Is this good or bad for the thesis overall -- read this one first.' }
      ]
    );

    container.innerHTML = `
      ${about}
      <div class="scenario-controls">
        <select class="filter-select" id="sc-factor"></select>
        <select class="filter-select" id="sc-scenario"></select>
      </div>
      <div class="scenario-result" id="sc-result"></div>
      <div style="margin-top:20px;">
        <h3>Good reason to cut rates, or bad reason?</h3>
        <p style="font-size:13px;max-width:700px;">If rates get cut because inflation came down, that's good news: incomes hold up and borrowing gets cheaper. If rates get cut because the economy is in trouble, that's worse: tenants struggle to pay, and lenders get cautious anyway. (GDP factor, p.23-24)</p>
        <h3>Who moves first, who moves last</h3>
        <p style="font-size:13px;max-width:700px;">Housing moves first, because mortgage rates and buyer confidence react fast. Logistics and retail follow consumer spending. Offices and hotels move last, because companies and travellers are slower to change their budgets. (GDP factor, p.23)</p>
      </div>
    `;

    const factorSel = document.getElementById('sc-factor');
    factorSel.innerHTML = factors.map(f => `<option value="${f.id}">${DetailPanel.esc(f.name)}</option>`).join('');

    function updateScenarioOptions() {
      const f = factors.find(x => x.id === factorSel.value);
      const scSel = document.getElementById('sc-scenario');
      scSel.innerHTML = f.scenarios.map((s, i) => `<option value="${i}">${DetailPanel.esc(s.scenario)}</option>`).join('');
      updateResult();
    }

    function updateResult() {
      const f = factors.find(x => x.id === factorSel.value);
      const s = f.scenarios[document.getElementById('sc-scenario').value];
      document.getElementById('sc-result').innerHTML = `
        <div class="scenario-card"><h4>What happens</h4><p>${DetailPanel.esc(s.whatHappens)}</p></div>
        <div class="scenario-card"><h4>Helped</h4><p>${DetailPanel.esc(s.helped)}</p></div>
        <div class="scenario-card"><h4>Hurt</h4><p>${DetailPanel.esc(s.hurt)}</p></div>
        <div class="scenario-card" style="border-color:var(--prov-notes);"><h4>Net read for thesis</h4><p><b>${DetailPanel.esc(s.netRead)}</b></p></div>
      `;
    }

    factorSel.addEventListener('change', updateScenarioOptions);
    document.getElementById('sc-scenario').addEventListener('change', updateResult);
    updateScenarioOptions();
  }

  window.ViewScenario = { render };
})();
