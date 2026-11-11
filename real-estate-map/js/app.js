// App shell: data loading, tab nav, global filters (provenance/sensitivity), theme, help overlay.

(function () {
  'use strict';

  const state = {
    DATA: null,
    hierarchy: null,
    filters: { hideAdded: false, hideProposed: false, sensitivityMin: 0 },
    activeView: 'fullpicture'
  };
  window.AppState = state;

  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll('.tab'));
    tabs.forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
  }

  const viewInitialized = {};
  function switchView(viewId) {
    state.activeView = viewId;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === viewId));
    document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'view-' + viewId);
    const initFns = {
      fullpicture: window.ViewFullPicture,
      chain: window.ViewChain,
      network: window.ViewNetwork,
      heatmap: window.ViewHeatmap,
      scenario: window.ViewScenario
    };
    const mod = initFns[viewId];
    if (mod && mod.render) mod.render(state.DATA, state.hierarchy, state.filters);
  }

  function setupFilters() {
    const hideAdded = document.getElementById('filter-hide-added');
    const hideProposed = document.getElementById('filter-hide-proposed');
    function reRenderActive() { switchView(state.activeView); }
    hideAdded.addEventListener('change', () => { state.filters.hideAdded = hideAdded.checked; hideAdded.parentElement.classList.toggle('active', hideAdded.checked); reRenderActive(); });
    hideProposed.addEventListener('change', () => { state.filters.hideProposed = hideProposed.checked; hideProposed.parentElement.classList.toggle('active', hideProposed.checked); reRenderActive(); });
  }

  // localStorage can throw (private windows, sandboxed hosting) -- never let that stop the app loading.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    remove(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function setupTheme() {
    const btn = document.getElementById('theme-toggle');
    const root = document.documentElement;
    const saved = store.get('rsmap-theme');
    if (saved) root.setAttribute('data-theme', saved);
    function label() {
      const cur = root.getAttribute('data-theme');
      btn.textContent = cur === 'dark' ? '☀ Light' : cur === 'light' ? '🌓 Auto' : '🌙 Dark';
    }
    label();
    btn.addEventListener('click', () => {
      const cur = root.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : cur === 'light' ? null : 'dark';
      if (next) { root.setAttribute('data-theme', next); store.set('rsmap-theme', next); }
      else { root.removeAttribute('data-theme'); store.remove('rsmap-theme'); }
      label();
    });
  }

  function setupHelp() {
    const overlay = document.getElementById('help-overlay');
    document.getElementById('help-btn').addEventListener('click', () => { overlay.hidden = false; });
    document.getElementById('help-close').addEventListener('click', () => { overlay.hidden = true; });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { overlay.hidden = true; DetailPanel.close(); }
    });
    if (!store.get('rsmap-help-seen')) {
      overlay.hidden = false;
      store.set('rsmap-help-seen', '1');
    }
  }

  async function init() {
    try {
      const DATA = await DataLoader.loadAll();
      state.DATA = DATA;
      state.hierarchy = DataLoader.assembleHierarchy(DATA);
      setupTabs();
      setupFilters();
      setupTheme();
      setupHelp();
      document.getElementById('detail-panel-close-outer').addEventListener('click', DetailPanel.close);
      switchView('fullpicture');
      document.getElementById('loading-banner').style.display = 'none';
    } catch (err) {
      document.getElementById('loading-banner').textContent = 'Failed to load data: ' + err.message + ' (are you running this via a local server, e.g. `npx serve`, rather than opening the file directly?)';
      console.error(err);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
