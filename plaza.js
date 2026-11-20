// Rooftop & Reef: the plaza. A 480x270 pixel canvas where two friends' halves meet at "the Seam".
// Left half: Townsville beach. Right half: Mumbai rooftop. Each half follows ITS city's real clock and live weather.
// Everything is read from two small card files (cards/<id>.json); this page never writes anything and never sends anything.
// Card text is untrusted: it is only ever put on the page with textContent.
(function () {
  'use strict';
  const W = 480, H = 270, SEAM = 240;
  const cv = document.getElementById('plaza');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const qs = new URLSearchParams(location.search);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const blend = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  const rgb = (a) => 'rgb(' + a.map(v => Math.round(v)).join(',') + ')';
  const mixHex = (a, b, u) => rgb(blend(hex(a), hex(b), u));
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const OKHEX = /^#[0-9a-fA-F]{6}$/;
  const shade = (h, f) => '#' + hex(h).map(v => clamp(Math.round(v * f), 0, 255).toString(16).padStart(2, '0')).join('');

  // ---------- state ----------
  const S = { t: 0, last: 0, people: [], hours: {}, wx: {}, parts: [], hover: null, open: null };

  // ---------- time in each city (override with ?samay=21.5&nishank=16 to preview) ----------
  function hourIn(tz, override) {
    if (override !== null && override !== undefined && override !== '' && Number.isFinite(parseFloat(override))) return parseFloat(override);
    try {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      const g = (t) => Number((p.find(x => x.type === t) || {}).value || 0);
      return (g('hour') % 24) + g('minute') / 60;
    } catch { return new Date().getHours(); }
  }
  const KEYS = [                                  // hour, sky top, sky horizon, night 0..1, sunset glow 0..1
    [0, '#050818', '#1b1f4a', 1, 0], [5, '#050818', '#1b1f4a', 1, 0],
    [6.2, '#3b3f7a', '#ffc08a', 0.45, 1], [8, '#3a8fe0', '#bfe6fa', 0, 0.1],
    [16.4, '#3a8fe0', '#bfe6fa', 0, 0.1], [18.2, '#3a3a7a', '#ffb36b', 0.3, 1],
    [19.4, '#1a1a4a', '#e07a6a', 0.7, 0.6], [20.8, '#050818', '#1b1f4a', 1, 0], [24, '#050818', '#1b1f4a', 1, 0],
  ];
  function sky(h) {
    let i = 0; while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1], u = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
    return { top: blend(hex(a[1]), hex(b[1]), u), hz: blend(hex(a[2]), hex(b[2]), u), N: a[3] + (b[3] - a[3]) * u, S: a[4] + (b[4] - a[4]) * u,
      prog: clamp((h - 5.8) / 12.8, 0, 1), sunUp: h > 5.7 && h < 18.7 };
  }

  // ---------- sprites (same pixel maps as the Command Center's sanctum) ----------
  function blit(rows, pal, x, y, o) {
    o = o || {}; const w = rows[0].length;
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < w; c++) {
      const k = rows[r][c]; if (k === '.' || k === ' ') continue;
      const col = pal[k]; if (!col) continue;
      ctx.fillStyle = col; ctx.fillRect(Math.round(x + (o.flip ? w - 1 - c : c)), Math.round(y + r), 1, 1);
    }
    if (o.alpha !== undefined) ctx.globalAlpha = 1;
  }
  const HUNTER = [
    '.....OOOOOO.....', '....OHHHHHHO....', '...OHHhHHhHHO...', '..OHHhHHHHhHHO..', '..OHHHHHHHHHHO..', '.OHHHSSSSSSHHHO.',
    '.OHHSSSSSSSSHHO.', '.OHHSBBSSBBSHHO.', '.OHHSEPSSEPSHHO.', '.OHHSSSSSSSSHHO.', '..OHSSSsSSSSHO..', '...OHSSMMSSHO...',
    '....OSSSSSSO....', '.....OsSSsO.....', '....OTTTTTTO....', '..OOTTTTTTTTOO..', '.OTTTTtttTTTTTO.', '.OTTTTTttTTTTTO.',
    'OSSOTTTTTTTTOSSO', 'OSSOTTTTTTTTOSSO', 'OSsOTTTuuTTTOsSO', '.OSSOTTTTTTOSSO.', '..OOOTTTTTTOOO..', '....ONNNNNNO....',
    '....ONNnnNNO....', '....ONNNONNNO...', '....ONNNONNNO...', '...OFFFFOFFFFO..', '...OOOOOOOOOOO..',
  ];
  const SHADOW = [
    '......OOOO......', '....OODDDDOO....', '...ODDDDDDDDO...', '..ODDDDDDDDDDO..', '..ODDKKKKKKDDO..', '..ODKKKKKKKKDO..', '..ODKEKKKKEKDO..',
    '..ODKKKKKKKKDO..', '..ODDKKKKKKDDO..', '...ODDDDDDDDO...', '..ODDDDddDDDDO..', '.ODDDDDddDDDDDO.', '.ODDdDDDDDDdDDO.', '.ODDdDDDDDDdDDO.',
    '.ODDDDDDDDDDDDO.', '.ODDDdDDDDdDDDO.', '..ODDDDDDDDDDO..', '..ODDdDDDDdDDO..', '..ODDDDDDDDDDO..', '.ODDDDDDDDDDDDO.', '.ODDDdDDDDdDDDO.',
    '.ODD.DDD.DDDD.O.', '..O...D...D..O..',
  ];
  const SPAL = { O: '#07040f', D: '#1c1432', d: '#34265e', K: '#050309', E: '#b99bff' };
  function palFor(av) {
    const a = { hair: '#14110f', skin: '#b07a50', shirt: '#26334d', trousers: '#2a2a33' };
    for (const k of Object.keys(a)) if (av && OKHEX.test(String(av[k]))) a[k] = av[k];
    return { O: '#0f0a16', H: a.hair, h: shade(a.hair, 1.9), S: a.skin, s: shade(a.skin, 0.78), B: shade(a.hair, 0.9), E: '#efe6df', P: '#1a1018', M: shade(a.skin, 0.62),
      T: a.shirt, t: shade(a.shirt, 1.7), u: shade(a.shirt, 0.65), N: a.trousers, n: shade(a.trousers, 1.5), F: '#0f0f16' };
  }

  // ---------- the two worlds ----------
  const clipHalf = (side, fn) => { ctx.save(); ctx.beginPath(); if (side === 'left') ctx.rect(0, 0, SEAM, H); else ctx.rect(SEAM, 0, W - SEAM, H); ctx.clip(); fn(); ctx.restore(); };
  const STARS = Array.from({ length: 90 }, () => [rnd(2, W - 2), rnd(2, 118), rnd(0, 6.3)]);
  const RAINC = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];

  function skyGradient(T, bottom) {
    for (let y = 0; y < bottom; y++) { ctx.fillStyle = rgb(blend(T.top, T.hz, Math.pow(y / bottom, 0.8))); ctx.fillRect(0, y, W, 1); }
  }
  function starsAndMoon(T, mx, my) {
    if (T.N < 0.3) return;
    const a = clamp((T.N - 0.3) * 1.5, 0, 1);
    for (const [sx, sy, ph] of STARS) {
      const tw = 0.5 + 0.5 * Math.sin(S.t * 1.3 + ph); ctx.globalAlpha = a * (0.25 + 0.75 * tw) * clamp(1.1 - sy / 130, 0.2, 1); ctx.fillStyle = '#f4f0ff'; ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
    }
    ctx.globalAlpha = a;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) if (dx * dx + dy * dy <= 64 && (dx + 4) * (dx + 4) + (dy - 1) * (dy - 1) > 50) { ctx.fillStyle = '#f1edff'; ctx.fillRect(mx + dx, my + dy, 1, 1); }
    ctx.globalAlpha = 1;
  }
  function sun(T, x0, x1) {
    if (!T.sunUp || T.N > 0.8) return;
    const sx = Math.round(x0 + T.prog * (x1 - x0)), sy = Math.round(118 - Math.sin(T.prog * Math.PI) * 90), warm = clamp(T.S * 1.2, 0, 1);
    ctx.fillStyle = rgb(blend([255, 244, 190], [255, 150, 80], warm));
    for (let dy = -7; dy <= 7; dy++) { const dx = Math.floor(Math.sqrt(49 - dy * dy)); ctx.fillRect(sx - dx, sy + dy, dx * 2, 1); }
  }
  function clouds(T, x0, seed) {
    const c = blend(blend([255, 255, 255], T.hz, T.S * 0.6), [38, 40, 90], clamp(T.N * 1.1, 0, 1));
    for (let i = 0; i < 2; i++) {
      const cx = Math.round(x0 + ((i * 90 + seed + S.t * (1 + i * 0.4)) % 200) - 20), cy = 24 + i * 20;
      ctx.globalAlpha = 0.45 + 0.4 * (1 - T.N); ctx.fillStyle = rgb(c); ctx.fillRect(cx, cy, 46, 4); ctx.fillRect(cx + 8, cy - 3, 26, 3); ctx.fillRect(cx + 3, cy + 4, 36, 2);
    }
    ctx.globalAlpha = 1;
  }

  // Townsville: beach, palm, sea
  function drawBeach(T) {
    skyGradient(T, 120); sun(T, 14, 226); starsAndMoon(T, 70, 36); clouds(T, 0, 10);
    const seaA = blend(hex('#1a7fb8'), hex('#0e1a46'), T.N), seaB = blend(hex('#36c1c9'), hex('#0f4a62'), T.N);
    for (let y = 120; y < 172; y++) { ctx.fillStyle = rgb(blend(seaA, seaB, (y - 120) / 52)); ctx.fillRect(0, y, SEAM, 1); }
    for (let k = 0; k < 26; k++) { const x = (k * 53) % 230, y = 124 + (k * 17) % 44, a = 0.15 + 0.2 * Math.sin(S.t * 1.5 + k); ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = T.N > 0.6 ? '#9fb6ff' : '#ffffff'; ctx.fillRect(x + Math.round(Math.sin(S.t + k) * 2), y, 4, 1); }
    ctx.globalAlpha = 1;
    const sandA = blend(hex('#e6cd9c'), hex('#4a4258'), T.N), sandB = blend(hex('#b8996c'), hex('#272639'), T.N);
    for (let y = 172; y < H; y++) { ctx.fillStyle = rgb(blend(sandA, sandB, (y - 172) / 98 * 0.9)); ctx.fillRect(0, y, SEAM, 1); }
    const sh = Math.sin(S.t * 0.9) * 2; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, Math.round(171 + sh), SEAM, 2); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(0, Math.round(174 + sh), SEAM, 2);
    palm(30, 236, 108, -12);
  }
  function palm(x, base, h, lean) {
    ctx.fillStyle = '#5a3a28';
    for (let i = 0; i < h; i++) { const u = i / h, px = Math.round(x + lean * u * u), w = i > h * 0.85 ? 2 : 3; ctx.fillRect(px, base - i, w, 1); if (i % 7 === 0) { ctx.fillStyle = '#3e281c'; ctx.fillRect(px, base - i, w, 1); ctx.fillStyle = '#5a3a28'; } }
    const tx = Math.round(x + lean), ty = base - h, sway = reduce ? 0 : Math.sin(S.t * 1.2) * 1.5;
    ctx.fillStyle = '#2f7a4a';
    for (const [dx, dy] of [[-22, 10], [-16, 4], [-9, 1], [9, 1], [16, 4], [22, 10], [0, -4]]) for (let k = 0; k <= 10; k++) { const u = k / 10; ctx.fillRect(Math.round(tx + dx * u + sway * u), Math.round(ty + dy * u * u + (dy < 0 ? dy * u : 0) + 2 * u), 2, 2); }
    ctx.fillStyle = '#3f9a5e'; ctx.fillRect(tx - 1, ty - 1, 3, 3);
  }

  // Mumbai: skyline whose windows switch on and off, a roof edge and a water tank
  const CITY = (() => {
    const layers = [{ base: 176, hmin: 20, hmax: 70, wmin: 12, wmax: 24, col: '#171b4a', day: '#6a7aa8', prob: 0.4, seed: 11, cell: [5, 6], win: [1, 2] }, { base: 188, hmin: 50, hmax: 128, wmin: 20, wmax: 34, col: '#0b0d2b', day: '#46557f', prob: 0.55, seed: 37, cell: [6, 7], win: [3, 4] }];
    let id = 1;
    return layers.map(L => { const bs = []; let x = SEAM - 4, i = 0;
      while (x < W + 4) { const w = Math.round(L.wmin + hash(i, L.seed) * (L.wmax - L.wmin)), h = Math.round(L.hmin + Math.pow(hash(i, L.seed + 1), 1.4) * (L.hmax - L.hmin)), top = L.base - h, wins = [];
        const cols = Math.floor((w - 3) / L.cell[0]), rows = Math.floor((h - 8) / L.cell[1]);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) wins.push({ x: x + 2 + c * L.cell[0], y: top + 5 + r * L.cell[1], id: id++, p: L.prob * (0.55 + 0.9 * hash(id, 5)) });
        bs.push({ x, w, h, top, wins, tank: hash(i, L.seed + 2) > 0.72 }); x += w + (hash(i, L.seed + 4) > 0.6 ? 2 : 0); i++; }
      return { L, bs }; });
  })();
  function drawRooftop(T) {
    skyGradient(T, 156); sun(T, SEAM + 14, W - 14); starsAndMoon(T, 420, 36); clouds(T, SEAM, 60);
    CITY.forEach((layer, li) => {
      for (const b of layer.bs) {
        ctx.fillStyle = mixHex(layer.L.col, layer.L.day, 1 - T.N); ctx.fillRect(b.x, b.top, b.w, b.h + 20);
        if (b.tank) { ctx.fillStyle = mixHex('#05061a', '#34406a', 1 - T.N); ctx.fillRect(b.x + 3, b.top - 5, 7, 5); }
        for (const w of b.wins) {
          const per = 9 + (w.id * 13) % 27, on = hash(w.id, reduce ? 0 : Math.floor((S.t + w.id * 2.3) / per)) < w.p * clamp(T.N * 1.15, 0.05, 1);
          if (!on) continue;
          ctx.fillStyle = ['#ffd98a', '#ffcf6e', '#fff1c4', '#ffb35c', '#bfe2ff'][w.id % 5]; ctx.globalAlpha = li === 0 ? 0.65 : 0.95; ctx.fillRect(w.x, w.y, layer.L.win[0], layer.L.win[1]);
        }
        ctx.globalAlpha = 1;
      }
    });
    ctx.fillStyle = '#2b2940'; ctx.fillRect(SEAM, 187, SEAM, 20);
    ctx.fillStyle = '#4a4660'; ctx.fillRect(SEAM, 184, SEAM, 4); ctx.fillStyle = '#6a6684'; ctx.fillRect(SEAM, 184, SEAM, 1);
    for (let y = 207; y < H; y++) { ctx.fillStyle = mixHex('#2a2840', '#1b1a2b', clamp((y - 207) / 40, 0, 1)); ctx.fillRect(SEAM, y, SEAM, 1); }
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (const y of [226, 246, 266]) ctx.fillRect(SEAM, y, SEAM, 1);
    tank(436, 214); plant(458, 234);
  }
  function tank(x, base) { ctx.fillStyle = '#0a0a14'; ctx.fillRect(x + 3, base - 4, 3, 6); ctx.fillRect(x + 22, base - 4, 3, 6); ctx.fillStyle = '#16161f'; ctx.fillRect(x, base - 30, 28, 24); ctx.fillRect(x + 2, base - 33, 24, 3); ctx.fillStyle = '#23232f'; ctx.fillRect(x + 4, base - 30, 3, 24); }
  function plant(x, y) { ctx.fillStyle = '#6b3b2a'; ctx.fillRect(x - 5, y, 10, 7); ctx.fillStyle = '#2f7a4a'; for (const [dx, dy] of [[-4, -8], [0, -12], [3, -7], [-2, -4], [2, -3]]) ctx.fillRect(x + dx, y + dy, 3, 3); }

  // The Seam: stone plaza, a lamp, the notice board and a bridge of lights that glows when you are both awake
  function drawSeam(awake) {
    for (let y = 212; y < H; y++) { const u = (y - 212) / 58; ctx.fillStyle = mixHex('#6a6684', '#3c3a52', u); ctx.fillRect(160, y, 160, 1); }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 218; y < H; y += 12) for (let x = 160 + ((y / 12) % 2) * 9; x < 320; x += 18) ctx.fillRect(x, y, 1, 11);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 218; y < H; y += 12) ctx.fillRect(160, y, 160, 1);
    ctx.fillStyle = '#2a2838'; ctx.fillRect(156, 212, 4, 58); ctx.fillRect(320, 212, 4, 58);          // plaza edges
    ctx.fillStyle = '#23222f'; ctx.fillRect(SEAM - 1, 150, 3, 64);                                      // lamp post
    ctx.fillStyle = '#ffe9b0'; ctx.fillRect(SEAM - 3, 146, 7, 6); ctx.fillStyle = '#23222f'; ctx.fillRect(SEAM - 4, 144, 9, 2);
    // bridge of lights
    for (let x = 96; x <= 384; x += 8) {
      const y = Math.round(138 + Math.sin((x - 96) / 288 * Math.PI) * 16 - 4), i = (x - 96) / 8;
      ctx.fillStyle = '#2a2c48'; ctx.fillRect(x, y, 8, 1);
      ctx.globalAlpha = awake ? 0.75 + 0.25 * Math.sin(S.t * 2.4 + i) : 0.25; ctx.fillStyle = awake ? ['#ffd98a', '#ff9a5a', '#ffe9b0'][i % 3] : '#6a6684'; ctx.fillRect(x + 3, y + 1, 2, 3); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#191a2e'; ctx.fillRect(94, 136, 2, 76); ctx.fillRect(384, 136, 2, 76);
    if (awake) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(SEAM, 150, 4, SEAM, 150, 120); g.addColorStop(0, 'rgba(255,190,100,0.22)'); g.addColorStop(1, 'rgba(255,190,100,0)'); ctx.fillStyle = g; ctx.fillRect(100, 40, 280, 220); ctx.globalCompositeOperation = 'source-over'; }
  }
  function drawBoard(hover) {
    const x = SEAM - 11, y = 224;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 1, y + 29, 24, 2);
    ctx.fillStyle = '#4a3322'; ctx.fillRect(x + 2, y + 18, 3, 12); ctx.fillRect(x + 17, y + 18, 3, 12);
    ctx.fillStyle = hover ? '#a8743f' : '#8a5a30'; ctx.fillRect(x, y, 22, 20); ctx.fillStyle = '#6e4624'; ctx.fillRect(x, y, 22, 2);
    for (const [px, py, c] of [[3, 4, '#f4ecd8'], [10, 5, '#e8d9a8'], [14, 11, '#f4ecd8'], [4, 12, '#d8e8f0']]) { ctx.fillStyle = c; ctx.fillRect(x + px, y + py, 6, 5); ctx.fillStyle = '#c0392b'; ctx.fillRect(x + px + 2, y + py, 1, 1); }
    S.boardBox = { x: x - 2, y: y - 2, w: 26, h: 34 };
  }

  // ---------- people ----------
  function weatherFx(side, code) {
    if (!RAINC.includes(code)) return;
    const x0 = side === 'left' ? 0 : SEAM, n = 70;
    ctx.fillStyle = 'rgba(190,210,255,0.55)';
    for (let i = 0; i < n; i++) { const x = x0 + ((i * 37 + S.t * 40) % SEAM), y = ((i * 53 + S.t * 220) % H); ctx.fillRect(Math.round(x), Math.round(y), 1, 4); }
  }
  function layoutPeople() {
    S.people.forEach(p => { const left = p.cfg.side === 'left'; p.x = left ? 205 : 275; p.y = 248; p.face = left ? 1 : -1; p.ph = left ? 0 : 2; });
  }
  function drawPerson(p) {
    const bob = Math.floor(S.t * 1.1 + p.ph) % 2 ? 1 : 0, x = Math.round(p.x - 8), y = Math.round(p.y - 29) + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(Math.round(p.x - 7), Math.round(p.y), 14, 2);
    blit(HUNTER, p.pal, x, y, { flip: p.face < 0 });
    p.box = { x: x - 2, y: y - 2, w: 20, h: 33 };
    // shadows trail behind
    const sh = (p.card.shadows || []).slice(0, 3);
    sh.forEach((s, i) => {
      const ti = ['Soldier', 'Knight', 'Elite', 'General'].indexOf(s.tier), sx = Math.round(p.x - p.face * (30 + i * 26)), fl = Math.round(Math.sin(S.t * 1.6 + i + p.ph) * 1.2) - 1, sy = Math.round(p.y - 23 + 2 - i * 3) + fl;
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(sx - 7, sy + 24, 14, 2);
      if (ti >= 2) { const a = 0.2 + 0.15 * Math.sin(S.t * 2.2 + i); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) blit(SHADOW, { O: '#9b6bff', D: '#9b6bff', d: '#9b6bff', K: '#9b6bff', E: '#9b6bff' }, sx - 8 + ox, sy + oy, { alpha: a }); }
      blit(SHADOW, ti >= 3 ? { ...SPAL, E: '#ff6a7a' } : SPAL, sx - 8, sy, { flip: p.face > 0 });
      if (ti >= 1) blit(['.GGGGGGGG.', 'GHGGGGGGHG'], { G: '#8a8fa8', H: '#c4c9de' }, sx - 5, sy + 1, {});
      p.shadowBoxes[i] = { x: sx - 10, y: sy - 2, w: 20, h: 28, s };
    });
  }


  // ---------- lanterns: one-line notes that drift across the OTHER person's half for a week ----------
  const LANTERN_DAYS = 7;
  const READ_KEY = 'rr-lanterns-read';
  const readSet = (() => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); } })();
  const saveRead = () => { try { localStorage.setItem(READ_KEY, JSON.stringify([...readSet].slice(-200))); } catch { /* storage blocked */ } };
  const todayISO = () => new Date().toLocaleDateString('en-CA');
  const dayDiff = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000);
  function lanternId(from, l) { let h = 0; for (const ch of from + l.date + l.text) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return from + '-' + l.date + '-' + h.toString(36); }
  function collectLanterns() {
    S.lanterns = [];
    const today = todayISO();
    for (const from of S.people) {
      for (const l of (from.card.lanterns || [])) {
        if (!l || typeof l.text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(String(l.date)) || typeof l.to !== 'string') continue;
        const to = S.people.find(x => x.cfg.id === l.to.toLowerCase());
        const age = dayDiff(l.date, today);
        if (!to || to === from || age < 0 || age >= LANTERN_DAYS) continue;
        S.lanterns.push({ id: lanternId(from.cfg.id, l), from, to, date: l.date, text: l.text.slice(0, 140), age, ph: rnd(0, 6.3), x0: rnd(0, 200), speed: rnd(4, 7) });
      }
    }
    const perHalf = {};
    for (const L of S.lanterns) { const k = L.to.cfg.side; L.slot = perHalf[k] = (perHalf[k] || 0) + 1; }
  }
  const LANTERN = ['..OOO..', '.ORRRO.', 'ORYYYRO', 'ORYYYRO', 'ORYYYRO', 'ORYYYRO', '.ORRRO.', '..OOO..'];
  function lanternPos(L) {
    const left = L.to.cfg.side === 'left', x0 = left ? 14 : SEAM + 14, w = SEAM - 28;
    const x = x0 + ((L.x0 + (reduce ? 0 : S.t * L.speed)) % w), y = 30 + ((L.slot - 1) % 3) * 34 + Math.round(Math.sin(S.t * 0.7 + L.ph) * 4);
    return { x: Math.round(x), y };
  }
  function drawLanterns(glowPass) {
    for (const L of S.lanterns || []) {
      const { x, y } = lanternPos(L), unread = !readSet.has(L.id), fade = 1 - clamp((L.age - 4) / 4, 0, 0.55);
      if (glowPass) {
        if (!unread) continue;
        const g = ctx.createRadialGradient(x, y + 4, 1, x, y + 4, 26); g.addColorStop(0, `rgba(255,170,70,${0.38 * fade})`); g.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = g; ctx.fillRect(x - 26, y - 22, 52, 52);
        continue;
      }
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x, y - 6, 1, 6);                                    // string
      blit(LANTERN, unread ? { O: '#7a2a10', R: '#d9461a', Y: '#ffd27a' } : { O: '#3a2c26', R: '#7a5a46', Y: '#a88a6a' }, x - 3, y, {});
      ctx.fillStyle = unread ? '#ffe9b0' : '#8a7a68'; ctx.fillRect(x - 1, y + 8, 3, 2);           // tassel
      if (unread && !reduce && Math.sin(S.t * 3 + L.ph) > 0.9) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x + 5, y + 2, 1, 1); ctx.fillRect(x - 6, y + 5, 1, 1); }
      ctx.globalAlpha = 1;
      L.box = { x: x - 6, y: y - 6, w: 13, h: 20 };
    }
  }
  const letter = document.getElementById('letter');
  function openLetter(L) {
    letter.replaceChildren();
    const head = el('div', 'l-head'); head.append(el('b', '', `A lantern from ${L.from.card.name}`), el('span', 'l-sub', ` for ${L.to.card.name} · ${L.date}`));
    const close = el('button', 'c-close', '×'); close.setAttribute('aria-label', 'Close'); close.onclick = closeLetter; head.append(close);
    letter.append(head, el('p', 'l-text', L.text));
    letter.hidden = false; readSet.add(L.id); saveRead();
  }
  function closeLetter() { letter.hidden = true; }

  // ---------- pass the flame: each person's fire (beach campfire or rooftop diya) grows with today's cleared quests ----------
  // A card only says "n of 5 today" and a date. When both friends have cleared 3+ on the SAME day the two fires link with a trail of sparks;
  // when both clear all five the flames burn violet. A card older than a day is just a quiet ember (no penalty, nothing is lost).
  function flameOf(p) {
    const t = p.card.today;
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.date)) || !Number.isFinite(t.cleared)) return null;
    const age = p.demo ? 0 : dayDiff(t.date, todayISO());     // demo cards always count as today
    if (age > 1 || age < -1) return null;
    return { n: clamp(Math.floor(t.cleared), 0, 5), date: p.demo ? todayISO() : t.date };
  }
  function flameSetup() {
    for (const p of S.people) { p.flame = flameOf(p); const left = p.cfg.side === 'left'; p.fx = left ? 118 : 362; p.fy = 254; }
    const l = S.people.find(p => p.cfg.side === 'left'), r = S.people.find(p => p.cfg.side === 'right');
    S.link = 0;
    if (l && r && l.flame && r.flame && l.flame.date === r.flame.date && l.flame.n >= 3 && r.flame.n >= 3) S.link = (l.flame.n === 5 && r.flame.n === 5) ? 2 : 1;
    S.linkEnds = (l && r) ? [l, r] : null;
  }
  function flameCol() { return S.link === 2 ? { a: '#9b6bff', b: '#d9c4ff', c: '#f3eaff', glow: '155,107,255' } : { a: '#e8561c', b: '#ffb347', c: '#fff1b8', glow: '255,160,60' }; }
  function drawFlames(glowPass) {
    const C = flameCol();
    for (const p of S.people) {
      const f = p.flame; if (!f) continue;
      const x = p.fx, y = p.fy, n = f.n, fl = reduce ? 0 : Math.sin(S.t * 7 + p.ph * 3) * 0.6;
      if (glowPass) {
        const R = 14 + n * 6 + (S.link ? 8 : 0), g = ctx.createRadialGradient(x, y - 4, 1, x, y - 4, R); g.addColorStop(0, `rgba(${C.glow},${n === 0 ? 0.08 : 0.2 + n * 0.05})`); g.addColorStop(1, `rgba(${C.glow},0)`); ctx.fillStyle = g; ctx.fillRect(x - R, y - 4 - R, R * 2, R * 2);
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 9, y + 2, 18, 2);
      if (p.card.sanctum === 'rooftop') {                                                            // diya: a little clay dish
        ctx.fillStyle = '#6b3b2a'; ctx.fillRect(x - 6, y - 1, 12, 3); ctx.fillStyle = '#8a4e34'; ctx.fillRect(x - 5, y - 2, 10, 1); ctx.fillStyle = '#3a2418'; ctx.fillRect(x - 4, y + 2, 8, 1);
      } else {                                                                                       // campfire: stone ring and two logs
        ctx.fillStyle = '#8a8fa8'; for (const dx of [-8, -5, -2, 2, 5]) ctx.fillRect(x + dx, y + 1, 3, 2);
        ctx.fillStyle = '#5a3a28'; ctx.fillRect(x - 6, y - 1, 12, 2); ctx.fillStyle = '#3e281c'; ctx.fillRect(x - 5, y - 3, 10, 2);
      }
      if (n === 0) { ctx.fillStyle = Math.sin(S.t * 2 + p.ph) > 0 ? '#ff7a3a' : '#a8441c'; ctx.fillRect(x - 1, y - 3, 2, 1); continue; }   // ember
      const h = 3 + n * 2, w = 2 + Math.ceil(n * 0.9);
      for (let i = 0; i < h; i++) {
        const u = i / h, ww = Math.max(1, Math.round(w * (1 - u * 0.85))), sway = Math.round(fl * u * 1.5);
        ctx.fillStyle = u < 0.35 ? C.c : u < 0.7 ? C.b : C.a; ctx.fillRect(x - Math.floor(ww / 2) + sway, y - 3 - i, ww, 1);
      }
      if (!reduce && n >= 3) for (let k = 0; k < n - 1; k++) { const t = (S.t * 0.7 + k * 0.37 + p.ph) % 1; ctx.globalAlpha = 1 - t; ctx.fillStyle = C.b; ctx.fillRect(Math.round(x + Math.sin(S.t * 2 + k * 2) * 5), Math.round(y - 6 - h - t * 14), 1, 1); ctx.globalAlpha = 1; }
    }
    if (S.link && S.linkEnds) {                                                                      // the trail of sparks between the two fires
      const [a, b] = S.linkEnds, C2 = flameCol();
      for (let i = 0; i < 22; i++) {
        const u = ((i / 22) + (reduce ? 0 : S.t * 0.07)) % 1, x = a.fx + (b.fx - a.fx) * u, y = 262 + Math.sin(u * Math.PI * 3 + S.t * 1.5) * 2 - Math.sin(u * Math.PI) * 3;
        if (glowPass) continue;
        ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(S.t * 2 + i)); ctx.fillStyle = i % 3 ? C2.b : C2.c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------- frame ----------
  function frame(ts) {
    requestAnimationFrame(frame);
    if (ts - S.last < 33) return;
    const dt = Math.min(0.1, (ts - S.last) / 1000 || 0.033); S.last = ts; S.t += dt;
    ctx.clearRect(0, 0, W, H);
    const left = S.people.find(p => p.cfg.side === 'left'), right = S.people.find(p => p.cfg.side === 'right');
    const hl = left ? S.hours[left.cfg.id] : 12, hr = right ? S.hours[right.cfg.id] : 12;
    const Tl = sky(hl), Tr = sky(hr);
    clipHalf('left', () => { drawBeach(Tl); if (left) weatherFx('left', S.wx[left.cfg.id] ? S.wx[left.cfg.id].code : -1); });
    clipHalf('right', () => { drawRooftop(Tr); if (right) weatherFx('right', S.wx[right.cfg.id] ? S.wx[right.cfg.id].code : -1); });
    const awake = (h) => h >= 7 && h < 23;
    S.awake = awake(hl) && awake(hr);
    drawSeam(S.awake); drawBoard(S.hover === 'board');
    for (const p of S.people) { p.shadowBoxes = p.shadowBoxes || []; drawPerson(p); }
    drawFlames(false); drawLanterns(false);
    ctx.globalCompositeOperation = 'lighter'; drawFlames(true); drawLanterns(true); ctx.globalCompositeOperation = 'source-over';
    // soft vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, W * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    updateHud(left, right, hl, hr);
  }

  // ---------- HUD and bubbles (text only via textContent) ----------
  const hud = document.getElementById('hud');
  const fmt = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
  let hudAt = 0;
  function updateHud(left, right, hl, hr) {
    if (S.t - hudAt < 1) return; hudAt = S.t;
    const wx = (p) => { const w = S.wx[p.cfg.id]; return w ? ` · ${Math.round(w.temp)}°` : ''; };
    const parts = [];
    if (left) parts.push(`${left.cfg.city} ${fmt(hl)}${wx(left)}`);
    if (right) parts.push(`${right.cfg.city} ${fmt(hr)}${wx(right)}`);
    const unread = (S.lanterns || []).filter(L => !readSet.has(L.id));
    hud.textContent = parts.join('   ·   ') + (S.awake ? '   ·   you are both awake' : '') + (S.link === 2 ? '   ·   the flame burns violet' : S.link === 1 ? '   ·   your fires are linked' : '') + (unread.length ? `   ·   ${unread.length} lantern${unread.length === 1 ? '' : 's'} unread` : '');
    for (const p of S.people) {
      const b = p.bubble; if (!b) continue;
      b.style.left = (p.x / W * 100) + '%'; b.style.top = ((p.y - 36) / H * 100) + '%';
      b.hidden = S.open !== null || !letter.hidden || !(p.card.now && p.card.now[0]);
    }
  }

  // ---------- loading cards ----------
  async function loadJSON(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }
  function validCard(c) { return c && c.schema === 1 && c.hunter && typeof c.name === 'string'; }
  async function loadPeople(cfg) {
    const out = [];
    for (const c of cfg.people) {
      let card = null, demo = false;
      try { card = await loadJSON(c.card); } catch { /* not published yet */ }
      if (!validCard(card)) { try { card = await loadJSON(c.demo); demo = true; } catch { card = null; } }
      if (validCard(card)) out.push({ cfg: c, card, demo, pal: palFor(card.avatar) });
    }
    return out;
  }
  async function loadWeather(p) {
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.cfg.lat}&longitude=${p.cfg.lon}&current=temperature_2m,weather_code`, { signal: ctl.signal });
      const j = await r.json(); S.wx[p.cfg.id] = { code: qs.get('rain') ? 61 : j.current.weather_code, temp: j.current.temperature_2m };
    } catch { if (qs.get('rain')) S.wx[p.cfg.id] = { code: 61, temp: 0 }; }
  }
  function tickHours() { for (const p of S.people) S.hours[p.cfg.id] = hourIn(p.cfg.tz, qs.get(p.cfg.id)); }

  // ---------- panel, board, interaction (DOM built with textContent only) ----------
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const ago = (iso) => { const t = Date.parse(iso); if (!t) return 'unknown'; const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const TRACKS = { craft: 'Craft', money: 'Money', body: 'Body', mind: 'Mind', social: 'Social' };
  function openCard(p, focusShadow) {
    S.open = p.cfg.id;
    const c = p.card, box = document.getElementById('card'); box.replaceChildren();
    const head = el('div', 'c-head'); head.append(el('h2', '', c.name), el('span', 'c-sub', `${p.cfg.city} · card updated ${ago(c.updated)}`));
    const close = el('button', 'c-close', '×'); close.setAttribute('aria-label', 'Close'); close.onclick = closeCard; head.append(close); box.append(head);
    if (p.demo) box.append(el('p', 'c-demo', 'Demo card: made-up numbers until the real card is published.'));
    const hr = el('div', 'c-rank'); hr.append(el('b', '', `Rank ${c.hunter.rank}`), el('span', '', ` ${c.hunter.title} · Level ${c.hunter.level} · ${c.hunter.xp} XP`)); box.append(hr);
    const stats = el('div', 'c-stats'); for (const [k, v] of Object.entries(c.hunter.stats || {})) { const r = el('div', 'c-stat'); r.append(el('span', 'k', k)); const bar = el('span', 'bar'); const f = el('span', 'fill'); f.style.width = clamp(Number(v) / 60 * 100, 2, 100) + '%'; bar.append(f); r.append(bar, el('span', 'v', String(v))); stats.append(r); } box.append(stats);
    if (c.now && c.now.length) { box.append(el('h3', '', 'Working on')); const ul = el('ul'); c.now.forEach(t => ul.append(el('li', '', t))); box.append(ul); }
    if (c.gate) { box.append(el('h3', '', 'This week\'s gate')); box.append(el('p', 'c-line', `${c.gate.name}: ${c.gate.done}/${c.gate.total} stages${c.gate.status === 'cleared' ? ' · cleared' : ''} · ${c.gate.cleared} gate${c.gate.cleared === 1 ? '' : 's'} cleared in total`)); }
    if (c.week) { box.append(el('h3', '', 'Last 7 days')); box.append(el('p', 'c-line', `${c.week.questsCleared} quests cleared · ${c.week.xp} XP`)); const w = el('div', 'c-week'); for (const [k, lab] of Object.entries(TRACKS)) { const n = Number((c.week.byTrack || {})[k] || 0); const col = el('div', 'c-col'); const b = el('span', 'cb'); b.style.height = clamp(n * 8, 3, 70) + 'px'; col.append(b, el('span', 'cl', lab), el('span', 'cn', String(n))); w.append(col); } box.append(w); }
    if (c.shadows && c.shadows.length) { box.append(el('h3', '', 'Shadow army')); const ul = el('ul', 'c-shadows'); c.shadows.forEach(s => { const li = el('li', focusShadow && focusShadow.id === s.id ? 'focus' : '', `${s.glyph || ''} ${s.name} · ${s.tier} · ${s.days} days`); ul.append(li); }); box.append(ul); }
    box.hidden = false; box.parentElement.classList.add('open');
    if (window.innerWidth <= 900) box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }
  function closeCard() { S.open = null; const box = document.getElementById('card'); box.hidden = true; box.parentElement.classList.remove('open'); }
  function renderBoard() {
    const list = document.getElementById('board-list'); list.replaceChildren();
    const rows = []; for (const p of S.people) for (const a of (p.card.asks || [])) if (a.status === 'open') rows.push({ who: p.card.name, side: p.cfg.side, a });
    rows.sort((x, y) => String(y.a.date).localeCompare(String(x.a.date)));
    if (!rows.length) list.append(el('li', 'empty', 'Nothing on the board. Quiet is fine.'));
    for (const r of rows) { const li = el('li'); li.append(el('span', 'who ' + r.side, r.who), el('span', 'date', r.a.date), el('span', 'text', r.a.text)); list.append(li); }
    const pl = document.getElementById('promise-list'); pl.replaceChildren();
    const STAT = { open: 'this week', done: 'done', partly: 'partly done', 'life happened': 'life happened' };
    for (const p of S.people) {
      const ps = (Array.isArray(p.card.promises) ? p.card.promises : []).filter(x => x && typeof x.text === 'string').slice(-2).reverse();
      if (!ps.length) { const li = el('li'); li.append(el('span', 'who ' + p.cfg.side, p.card.name), el('span', 'text', 'no promise this week')); pl.append(li); continue; }
      for (const x of ps) { const li = el('li'); li.append(el('span', 'who ' + p.cfg.side, p.card.name), el('span', 'date', String(x.date).slice(0, 10)), el('span', 'pstat s-' + String(x.status).replace(/\W+/g, '-'), STAT[x.status] || 'this week'), el('span', 'text', String(x.text).slice(0, 140))); pl.append(li); }
    }
    const now = document.getElementById('now-list'); now.replaceChildren();
    for (const p of S.people) { const li = el('li'); li.append(el('span', 'who ' + p.cfg.side, p.card.name)); li.append(el('span', 'text', (p.card.now || []).join(' · ') || 'nothing posted this week')); now.append(li); }
  }
  function toLogical(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H }; }
  const inBox = (b, p) => b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  function hit(p) {
    for (const L of (S.lanterns || [])) if (inBox(L.box, p)) return { kind: 'lantern', L };
    for (const per of S.people) { for (const sb of (per.shadowBoxes || [])) if (inBox(sb, p)) return { kind: 'shadow', per, s: sb.s }; if (inBox(per.box, p)) return { kind: 'person', per }; }
    if (inBox(S.boardBox, p)) return { kind: 'board' };
    return null;
  }
  cv.addEventListener('mousemove', (e) => { const h = hit(toLogical(e)); S.hover = h && h.kind === 'board' ? 'board' : null; cv.classList.toggle('pointer', !!h); });
  cv.addEventListener('click', (e) => {
    const h = hit(toLogical(e)); if (!h) { closeCard(); return; }
    if (h.kind === 'lantern') { openLetter(h.L); return; }
    if (h.kind === 'board') document.getElementById('board').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    else openCard(h.per, h.kind === 'shadow' ? h.s : null);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeCard(); closeLetter(); } });

  // ---------- start ----------
  (async function start() {
    let cfg; try { cfg = await loadJSON('config.json'); } catch { document.getElementById('hud').textContent = 'Could not load config.json'; return; }
    S.people = await loadPeople(cfg);
    if (!S.people.length) { document.getElementById('hud').textContent = 'No cards found yet.'; return; }
    layoutPeople(); collectLanterns(); flameSetup(); tickHours(); setInterval(tickHours, 20000);
    const stage = document.getElementById('stage');
    for (const p of S.people) { const b = el('div', 'bubble ' + p.cfg.side, ''); b.textContent = (p.card.now && p.card.now[0]) ? String(p.card.now[0]).slice(0, 56) : ''; stage.append(b); p.bubble = b; }
    if (S.people.some(p => p.demo)) document.getElementById('demo').hidden = false;
    renderBoard();
    S.people.forEach(loadWeather); setInterval(() => S.people.forEach(loadWeather), 15 * 60 * 1000);
    requestAnimationFrame(frame);
  })();
})();
