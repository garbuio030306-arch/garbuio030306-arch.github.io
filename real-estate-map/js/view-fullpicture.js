// View 1: Full Picture -- the research drawn as a house floor plan. Each top-level section is a room.
// Clicking a room animates the SVG viewBox into it (no d3.zoom, no free-form panning) and lays out
// that section's contents inside the room's walls, sized for the zoom level so text stays readable.
// The blueprint keeps a fixed navy palette regardless of light/dark theme.
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const PLAN = { x: 0, y: 0, w: 1000, h: 850 };

  // Which section lives in which room. Rects are in plan units (the house is ~1000 units wide).
  // Rooms are kept close to screen proportions so a zoomed-in room fills the stage.
  const ROOMS = {
    thesis:               { x: 290, y: 100, w: 270, h: 220 },  // hall, right behind the front door
    re_segments:          { x: 560, y: 100, w: 410, h: 320 },  // kitchen
    real_estate_vertical: { x: 30,  y: 250, w: 260, h: 350 },  // garage
    funds_picks:          { x: 290, y: 320, w: 270, h: 280 },  // living area
    macro_factors:        { x: 30,  y: 650, w: 940, h: 180 }   // backyard
  };

  // Wall segments [x1, y1, x2, y2]; the gaps between them are doorways. The house is L-shaped:
  // the corner below the kitchen is an open patio.
  const WALLS = [
    [290, 100, 390, 100], [460, 100, 970, 100],                       // front wall, porch opening
    [390, 100, 390, 60], [390, 60, 405, 60], [445, 60, 460, 60], [460, 60, 460, 100], // front porch
    [970, 100, 970, 420], [560, 420, 970, 420],                       // kitchen outer walls
    [290, 600, 400, 600], [450, 600, 560, 600],                       // back wall, back door
    [290, 100, 290, 420], [290, 470, 290, 600],                       // hall/garage/living wall
    [30, 250, 290, 250], [30, 600, 290, 600],                         // garage top/bottom
    [30, 250, 30, 300], [30, 550, 30, 600],                           // garage side, big door between
    [290, 320, 380, 320], [430, 320, 560, 320],                       // hall | living
    [560, 100, 560, 180], [560, 225, 560, 345], [560, 390, 560, 600]  // kitchen wall, two doors
  ];

  // Door leaves and swing arcs, purely to read as a floor plan.
  const DOORS = [
    { leaf: [405, 60, 405, 100], arc: 'M445,60 A40,40 0 0,1 405,100' },   // front door
    { leaf: [400, 600, 400, 650], arc: 'M450,600 A50,50 0 0,1 400,650' }, // back door
    { leaf: [430, 320, 430, 370], arc: 'M380,320 A50,50 0 0,0 430,370' }, // hall -> living
    { leaf: [290, 420, 340, 420], arc: 'M290,470 A50,50 0 0,0 340,420' }, // garage -> living
    { leaf: [560, 180, 605, 180], arc: 'M560,225 A45,45 0 0,0 605,180' }, // hall -> kitchen
    { leaf: [560, 390, 605, 390], arc: 'M560,345 A45,45 0 0,1 605,390' }  // living -> kitchen
  ];

  let currentRoom = null;   // survives re-renders (tab switches, filter toggles)
  let resizeObs = null;

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function filterTree(node, filters) {
    if (!node.children) {
      if (filters.hideAdded && node.provenance === 'added') return null;
      if (filters.hideProposed && node.provenance === 'proposed') return null;
      return { ...node };
    }
    const kids = node.children.map(c => filterTree(c, filters)).filter(Boolean);
    if (!kids.length && node.type === 'subcategory') return null;
    return { ...node, children: kids };
  }

  // ---------- Text fitting (monospace, so character width is predictable) ----------
  function wrapWords(text, maxChars) {
    const lines = [];
    let cur = '';
    text.split(/\s+/).forEach(word => {
      while (word.length > maxChars) {
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(word.slice(0, maxChars - 1) + '-');
        word = word.slice(maxChars - 1);
      }
      const trial = cur ? cur + ' ' + word : word;
      if (trial.length > maxChars && cur) { lines.push(cur); cur = word; }
      else cur = trial;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // Largest font in [minF, maxF] whose wrapped lines fit w x h; truncates with an ellipsis at minF.
  function fitLines(text, w, h, maxF, minF) {
    let f = maxF;
    for (;;) {
      const maxChars = Math.max(3, Math.floor(w / (f * 0.6)));
      const lines = wrapWords(text, maxChars);
      const maxLines = Math.max(1, Math.floor(h / (f * 1.2)));
      if (lines.length <= maxLines || f <= minF) {
        if (lines.length > maxLines) {
          lines.length = maxLines;
          lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + '…';
        }
        return { f, lines };
      }
      f = Math.max(minF, f * 0.92);
    }
  }

  // Draws lines vertically centred on cy.
  function drawLines(parent, x, cy, lines, f, cls, anchor) {
    const t = el('text', { class: cls, x, y: cy - (lines.length - 1) * f * 0.6 + f * 0.35, 'font-size': f, 'text-anchor': anchor || 'middle' }, parent);
    lines.forEach((line, i) => {
      const s = el('tspan', { x, dy: i === 0 ? 0 : f * 1.2 }, t);
      s.textContent = line;
    });
    return t;
  }

  // ---------- Room contents ----------
  function roomGroups(room) {
    const direct = room.children.filter(c => !c.children);
    const groups = [];
    if (direct.length) {
      const isChain = room.id === 'real_estate_vertical';
      groups.push({ title: isChain ? 'Value chain, first step to last' : null, items: direct, numbered: isChain });
    }
    room.children.filter(c => c.children).forEach(c => groups.push({ title: c.name, items: c.children }));
    return groups;
  }

  // Grid every group inside the room. u = plan units per screen pixel at the target zoom.
  function layoutRoom(rect, groups, u) {
    const pad = 14 * u, headH = 26 * u, groupHeadH = 18 * u, gap = 6 * u, groupGap = 10 * u;
    const x0 = rect.x + pad, y0 = rect.y + pad + headH;
    const W = rect.w - 2 * pad, H = rect.h - 2 * pad - headH;
    const titled = groups.filter(g => g.title).length;
    let best = null;
    for (let c = 1; c <= 6; c++) {
      const tileW = (W - (c - 1) * gap) / c;
      const rows = groups.map(g => Math.ceil(g.items.length / c));
      const R = rows.reduce((a, b) => a + b, 0);
      const fixed = titled * groupHeadH + (groups.length - 1) * groupGap + rows.reduce((a, r) => a + Math.max(0, r - 1) * gap, 0);
      const tileH = Math.min(72 * u, (H - fixed) / R);
      const score = Math.min(tileW / 3, tileH);   // aim for tiles about 3:1
      if (tileH > 0 && (!best || score > best.score)) best = { c, tileW, tileH, score };
    }
    const tiles = [], heads = [];
    let y = y0;
    groups.forEach(g => {
      if (g.title) { heads.push({ text: g.title, x: x0, y: y + groupHeadH * 0.55 }); y += groupHeadH; }
      g.items.forEach((item, i) => {
        const col = i % best.c, row = Math.floor(i / best.c);
        tiles.push({ item, x: x0 + col * (best.tileW + gap), y: y + row * (best.tileH + gap), w: best.tileW, h: best.tileH, num: g.numbered ? i + 1 : null });
      });
      const rows = Math.ceil(g.items.length / best.c);
      y += rows * best.tileH + (rows - 1) * gap + groupGap;
    });
    return { tiles, heads, pad, headH };
  }

  const DASH = { notes: null, added: [6, 3], proposed: [1.5, 3] };

  function render(DATA, hierarchyData, filters) {
    const container = document.getElementById('view-fullpicture');

    const about = AboutView.render(
      'About this view',
      'The whole research drawn as a house. Each room is one part of it. Walk in through the front door (the Thesis) and visit the other rooms to see what\'s inside.',
      [
        { label: 'Rooms', detail: 'One room per section: Thesis in the hall, Real Estate Segments in the kitchen, the value chain in the garage, Funds &amp; Picks in the living area, and the Macro Factors out in the backyard.' },
        { label: 'Click a room', detail: 'Zooms into it and lays out everything inside, grouped. Click a neighbouring room to walk over, or click outside the house, press Escape, or use "Whole house" to step back out.' },
        { label: 'Click an item', detail: 'Opens its full card on the right.' },
        { label: 'Line style', detail: 'Solid outline = <span class="prov-badge notes" style="font-size:9.5px;">notes</span>, dashed = <span class="prov-badge added" style="font-size:9.5px;">added</span>, dotted = <span class="prov-badge proposed" style="font-size:9.5px;">proposed</span>.' },
        { label: 'Search', detail: 'Type any name and pick a result to go straight to it.' }
      ]
    );

    container.innerHTML = `
      ${about}
      <div class="controls-row">
        <div class="search-box fp-search">
          <input id="fp-search" type="search" placeholder="Search everything in the house…" aria-label="Search the Full Picture" autocomplete="off">
          <div class="search-results" id="fp-search-results" hidden></div>
        </div>
        <div class="breadcrumb" id="fp-breadcrumb"></div>
        <div class="spacer"></div>
        <div class="legend">
          <span class="legend-item"><span class="legend-swatch notes"></span>notes</span>
          <span class="legend-item"><span class="legend-swatch added"></span>added</span>
          <span class="legend-item"><span class="legend-swatch proposed"></span>proposed</span>
        </div>
      </div>
      <div id="fp-stage" class="fp-stage"></div>
    `;

    const tree = filterTree(hierarchyData, filters);
    const roomsById = {};
    tree.children.forEach(r => { if (ROOMS[r.id]) roomsById[r.id] = r; });

    const stage = document.getElementById('fp-stage');
    const svg = el('svg', { class: 'house-svg', role: 'group', 'aria-label': 'Floor plan of the research', preserveAspectRatio: 'xMidYMid meet' }, stage);

    // Blueprint grid lives inside the SVG so it zooms with the plan.
    const defs = el('defs', {}, svg);
    const minor = el('pattern', { id: 'fp-grid-minor', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M10,0 L0,0 0,10', class: 'grid-minor' }, minor);
    const major = el('pattern', { id: 'fp-grid', width: 50, height: 50, patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: 50, height: 50, fill: 'url(#fp-grid-minor)' }, major);
    el('path', { d: 'M50,0 L0,0 0,50', class: 'grid-major' }, major);
    el('rect', { class: 'bg', x: -3000, y: -3000, width: 7000, height: 7000 }, svg);

    // Title block, like the corner of a drawing sheet.
    el('text', { class: 'plan-title', x: 30, y: 36 }, svg).textContent = tree.name.toUpperCase();
    el('text', { class: 'plan-sub', x: 30, y: 58 }, svg).textContent = 'FLOOR PLAN · ' + Object.keys(roomsById).length + ' ROOMS · CLICK A ROOM TO ENTER';

    // One screen tall (minus the search row), so the plan fills the view once the intro card is folded away.
    svg.style.height = Math.max(420, Math.min(820, container.clientHeight - 90)) + 'px';
    drawDecor(el('g', { class: 'decor-layer' }, svg));

    const fence = ROOMS.macro_factors;
    el('rect', { class: 'fence', x: fence.x, y: fence.y, width: fence.w, height: fence.h }, svg);
    const wallsG = el('g', {}, svg);
    WALLS.forEach(w => el('line', { class: 'wall-outer', x1: w[0], y1: w[1], x2: w[2], y2: w[3] }, wallsG));
    WALLS.forEach(w => el('line', { class: 'wall-inner', x1: w[0], y1: w[1], x2: w[2], y2: w[3] }, wallsG));
    el('line', { class: 'garage-door', x1: 30, y1: 300, x2: 30, y2: 550 }, wallsG);
    DOORS.forEach(d => {
      el('line', { class: 'door-leaf', x1: d.leaf[0], y1: d.leaf[1], x2: d.leaf[2], y2: d.leaf[3] }, wallsG);
      el('path', { class: 'door-arc', d: d.arc }, wallsG);
    });

    // Room hit areas + names
    const roomEls = {};
    Object.keys(ROOMS).forEach(id => {
      const room = roomsById[id];
      if (!room) return;
      const r = ROOMS[id];
      const g = el('g', { class: 'room', 'data-room': id, tabindex: 0, role: 'button', 'aria-label': 'Enter ' + room.name }, svg);
      el('rect', { class: 'room-hit', x: r.x + 4, y: r.y + 4, width: r.w - 8, height: r.h - 8 }, g);
      const fit = fitLines(room.name.toUpperCase(), r.w * 0.8, r.h * 0.55, 20, 11);
      drawLines(g, r.x + r.w / 2, r.y + r.h / 2, fit.lines, fit.f, 'room-label');
      g.addEventListener('click', (e) => { e.stopPropagation(); if (currentRoom !== id) focusRoom(id); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusRoom(id); } });
      roomEls[id] = g;
    });

    const interiorLayer = el('g', { class: 'interior-layer' }, svg);
    svg.addEventListener('click', () => { if (currentRoom) showHouse(); });

    // ---------- Camera: an animated viewBox, [centreX, centreY, width] for d3.interpolateZoom ----------
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let view = null, rafId = null;

    function aspect() {
      const w = svg.clientWidth, h = svg.clientHeight;
      return w && h ? w / h : PLAN.w / PLAN.h;
    }
    function fitView(rect, pad) {
      const a = aspect();
      let w = rect.w + 2 * pad;
      const h = rect.h + 2 * pad;
      if (w / h < a) w = h * a;
      return [rect.x + rect.w / 2, rect.y + rect.h / 2, w];
    }
    function applyView(v) {
      const w = v[2], h = w / aspect();
      svg.setAttribute('viewBox', `${v[0] - w / 2} ${v[1] - h / 2} ${w} ${h}`);
    }
    function animateTo(target, done) {
      cancelAnimationFrame(rafId);
      if (!view || reduceMotion) { view = target; applyView(view); if (done) done(); return; }
      const interp = d3.interpolateZoom(view, target);
      const dur = Math.min(900, Math.max(450, interp.duration * 0.5));
      const t0 = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        view = interp(d3.easeCubicInOut(t));
        applyView(view);
        if (t < 1) rafId = requestAnimationFrame(frame);
        else if (done) done();
      };
      rafId = requestAnimationFrame(frame);
    }
    function roomTarget(id) { return fitView(ROOMS[id], 26); }

    function drawInterior(id, target) {
      interiorLayer.innerHTML = '';
      const room = roomsById[id];
      const r = ROOMS[id];
      const u = target[2] / (svg.clientWidth || 900);
      const g = el('g', { class: 'interior' }, interiorLayer);
      const groups = roomGroups(room);
      const count = groups.reduce((a, gr) => a + gr.items.length, 0);
      const head = el('text', { class: 'interior-head', x: r.x + 14 * u, y: r.y + 14 * u + 15 * u, 'font-size': 15 * u }, g);
      head.textContent = room.name.toUpperCase();
      const countT = el('tspan', { class: 'interior-count', dx: 10 * u, 'font-size': 11 * u }, head);
      countT.textContent = count + (count === 1 ? ' ITEM' : ' ITEMS');
      if (!count) {
        drawLines(g, r.x + r.w / 2, r.y + r.h / 2, ['Nothing here with the current filters.'], 12 * u, 'interior-empty');
        return;
      }
      const lay = layoutRoom(r, groups, u);
      lay.heads.forEach(h => {
        const t = el('text', { class: 'group-head', x: h.x, y: h.y + 4 * u, 'font-size': 10.5 * u }, g);
        t.textContent = h.text.toUpperCase();
      });
      lay.tiles.forEach(t => {
        const item = t.item;
        const prov = item.provenance || 'notes';
        const tile = el('g', { class: 'tile prov-' + prov, 'data-leaf': item.id, tabindex: 0, role: 'button', 'aria-label': item.name }, g);
        const rect = el('rect', { x: t.x, y: t.y, width: t.w, height: t.h, rx: 2 * u }, tile);
        el('title', {}, tile).textContent = item.name;
        rect.style.strokeWidth = 1.3 * u;
        if (DASH[prov]) rect.style.strokeDasharray = DASH[prov].map(v => v * u).join(' ');
        const sens = item.sensitivity;
        const sub = sens ? (sens.qualitative + (sens.score10 != null ? ' · ' + sens.score10 + '/10' : '')) : null;
        const subF = 9.5 * u;
        const innerW = t.w - 16 * u;
        const label = (t.num ? t.num + '. ' : '') + item.name;
        const fit = fitLines(label, innerW, t.h - 8 * u, 12.5 * u, 9.5 * u);
        const textBlock = fit.lines.length * fit.f * 1.2;
        const showSub = sub && t.h - 8 * u - textBlock >= subF * 1.4;
        const blockH = textBlock + (showSub ? subF * 1.4 : 0);
        const top = t.y + (t.h - blockH) / 2;
        drawLines(tile, t.x + 8 * u, top + fit.lines.length * fit.f * 0.6, fit.lines, fit.f, 'tile-label', 'start');
        if (showSub) {
          const s = el('text', { class: 'tile-sub', x: t.x + 8 * u, y: top + fit.lines.length * fit.f * 1.2 + subF * 1.05, 'font-size': subF }, tile);
          s.textContent = sub.toUpperCase();
        }
        const open = (e) => {
          if (e) e.stopPropagation();
          interiorLayer.querySelectorAll('.tile.selected').forEach(n => n.classList.remove('selected'));
          tile.classList.add('selected');
          if (item.detailRef) DetailPanel.show(item.detailRef, DATA);
        };
        tile.addEventListener('click', open);
        tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    }

    function setFocusClasses() {
      svg.classList.toggle('in-room', !!currentRoom);
      Object.keys(roomEls).forEach(id => roomEls[id].classList.toggle('is-focus', id === currentRoom));
      svg.querySelectorAll('.decor').forEach(d => d.classList.toggle('hidden', d.dataset.room === currentRoom));
    }

    function focusRoom(id, opts) {
      opts = opts || {};
      if (!roomsById[id]) return;
      currentRoom = id;
      const target = roomTarget(id);
      setFocusClasses();
      drawInterior(id, target);
      updateBreadcrumb();
      const finish = () => { if (opts.leafId) revealLeaf(opts.leafId, opts.detailRef); };
      if (opts.instant) { cancelAnimationFrame(rafId); view = target; applyView(view); finish(); }
      else animateTo(target, finish);
    }

    function showHouse(opts) {
      currentRoom = null;
      interiorLayer.innerHTML = '';
      setFocusClasses();
      updateBreadcrumb();
      const target = fitView(PLAN, 10);
      if (opts && opts.instant) { cancelAnimationFrame(rafId); view = target; applyView(view); }
      else animateTo(target);
    }

    function revealLeaf(leafId, detailRef) {
      const tile = interiorLayer.querySelector(`.tile[data-leaf="${CSS.escape(leafId)}"]`);
      if (!tile) return;
      interiorLayer.querySelectorAll('.tile.selected').forEach(n => n.classList.remove('selected'));
      tile.classList.add('selected', 'found');
      setTimeout(() => tile.classList.remove('found'), 2000);
      tile.focus({ preventScroll: true });
      if (detailRef) DetailPanel.show(detailRef, DATA);
    }

    function updateBreadcrumb() {
      const bc = document.getElementById('fp-breadcrumb');
      if (!currentRoom) { bc.innerHTML = '<span class="bc-current">Whole house</span>'; return; }
      bc.innerHTML = `<button id="fp-bc-house">Whole house</button><span class="sep">›</span><span class="bc-current">${DetailPanel.esc(roomsById[currentRoom].name)}</span>`;
      document.getElementById('fp-bc-house').addEventListener('click', () => showHouse());
    }

    // ---------- Search: jump straight to any room, group or item ----------
    const index = [];
    tree.children.forEach(room => {
      if (!roomsById[room.id]) return;
      index.push({ name: room.name, where: 'Room', roomId: room.id });
      (function walk(nodes, groupName) {
        nodes.forEach(n => {
          if (n.children) { index.push({ name: n.name, where: room.name, roomId: room.id }); walk(n.children, n.name); }
          else index.push({ name: n.name, where: groupName ? room.name + ' › ' + groupName : room.name, roomId: room.id, leafId: n.id, detailRef: n.detailRef });
        });
      })(room.children, null);
    });

    const input = document.getElementById('fp-search');
    const results = document.getElementById('fp-search-results');
    let matches = [];
    function pick(m) {
      results.hidden = true;
      input.value = '';
      input.blur();
      focusRoom(m.roomId, { leafId: m.leafId, detailRef: m.detailRef });
    }
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.hidden = true; results.innerHTML = ''; return; }
      matches = index
        .filter(m => m.name.toLowerCase().includes(q) || m.where.toLowerCase().includes(q))
        .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || (b.name.toLowerCase().includes(q) - a.name.toLowerCase().includes(q)))
        .slice(0, 25);
      results.innerHTML = matches.length
        ? matches.map((m, i) => `<button data-idx="${i}">${DetailPanel.esc(m.name)}<span class="sr-type">${DetailPanel.esc(m.where)}</span></button>`).join('')
        : '<div class="sr-empty">No matches. Try a shorter word.</div>';
      results.hidden = false;
      results.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => pick(matches[+btn.dataset.idx])));
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && matches.length && !results.hidden) { e.preventDefault(); pick(matches[0]); }
      if (e.key === 'ArrowDown' && !results.hidden) { const b = results.querySelector('button'); if (b) { e.preventDefault(); b.focus(); } }
      if (e.key === 'Escape') { results.hidden = true; }
    });
    results.addEventListener('keydown', (e) => {
      const btns = Array.from(results.querySelectorAll('button'));
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < btns.length - 1) { e.preventDefault(); btns[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? btns[i - 1] : input).focus(); }
    });
    document.addEventListener('click', (e) => {
      if (!results.contains(e.target) && e.target !== input) results.hidden = true;
    });

    // Escape steps out of a room (capture phase, so it runs before the app closes the detail panel).
    window.__fpEscape && window.removeEventListener('keydown', window.__fpEscape, true);
    window.__fpEscape = (e) => {
      if (e.key !== 'Escape' || container.hidden || !currentRoom) return;
      if (document.getElementById('detail-panel').classList.contains('open')) return;
      if (document.activeElement === input) return;
      showHouse();
    };
    window.addEventListener('keydown', window.__fpEscape, true);

    // Keep the framing right when the stage changes size (window resize, rotating a phone).
    if (resizeObs) resizeObs.disconnect();
    resizeObs = new ResizeObserver(() => {
      if (!svg.clientWidth) return;
      if (currentRoom && roomsById[currentRoom]) focusRoom(currentRoom, { instant: true });
      else showHouse({ instant: true });
    });
    resizeObs.observe(svg);

    if (currentRoom && roomsById[currentRoom]) focusRoom(currentRoom, { instant: true });
    else showHouse({ instant: true });
  }

  // Faint furniture so each room reads as what it is; hidden in the room you're standing in.
  function drawDecor(layer) {
    function g(room) { return el('g', { class: 'decor', 'data-room': room }, layer); }
    const garage = g('real_estate_vertical');
    el('rect', { x: 115, y: 345, width: 90, height: 170, rx: 24 }, garage);
    el('path', { d: 'M123,395 Q160,380 197,395 M123,470 Q160,482 197,470' }, garage);
    el('rect', { x: 42, y: 262, width: 22, height: 110 }, garage);

    const kitchen = g('re_segments');
    el('path', { d: 'M700,108 L962,108 L962,300 L928,300 L928,142 L700,142 Z' }, kitchen);
    el('rect', { x: 742, y: 114, width: 52, height: 22, rx: 3 }, kitchen);
    [[860, 119], [878, 119], [860, 131], [878, 131]].forEach(p => el('circle', { cx: p[0], cy: p[1], r: 5 }, kitchen));
    el('rect', { x: 680, y: 330, width: 140, height: 56, rx: 4 }, kitchen);

    const living = g('funds_picks');
    el('rect', { x: 330, y: 546, width: 160, height: 40, rx: 8 }, living);
    el('rect', { x: 320, y: 538, width: 14, height: 48, rx: 5 }, living);
    el('rect', { x: 486, y: 538, width: 14, height: 48, rx: 5 }, living);
    el('circle', { cx: 410, cy: 470, r: 28 }, living);
    el('rect', { x: 505, y: 345, width: 40, height: 40, rx: 8 }, living);

    const hall = g('thesis');
    el('rect', { x: 345, y: 140, width: 160, height: 140, rx: 4, 'stroke-dasharray': '4 3' }, hall);

    const yard = g('macro_factors');
    [[90, 742, 34], [905, 745, 38], [905, 480, 40]].forEach(t => {
      el('circle', { cx: t[0], cy: t[1], r: t[2] }, yard);
      el('circle', { cx: t[0], cy: t[1], r: t[2] * 0.35 }, yard);
    });
    el('circle', { cx: 700, cy: 510, r: 22 }, yard);                 // patio table
    [[668, 510], [732, 510], [700, 478], [700, 542]].forEach(p => el('rect', { x: p[0] - 7, y: p[1] - 7, width: 14, height: 14, rx: 3 }, yard));
    [0, 1, 2].forEach(i => el('rect', { x: 414, y: 662 + i * 26, width: 22, height: 14, rx: 3 }, yard));
  }

  window.ViewFullPicture = { render };
})();
