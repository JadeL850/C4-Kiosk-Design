// Subject to View — horizontal kiosk scroller
const vp = document.getElementById('viewport');
const track = document.getElementById('track');
const stage = document.getElementById('stage');
const bar = document.getElementById('bar');
const W = 6769, H = 1080;

/* ---------- scale the 1080px-tall design to the screen ---------- */
function fit() {
  const s = window.innerHeight / H;
  stage.style.transform = `scale(${s})`;
  track.style.width = `${W * s}px`;
  progress();
}
window.addEventListener('resize', fit);
fit();

/* ---------- vertical wheel / trackpad → sideways scroll ---------- */
vp.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();
    vp.scrollLeft += e.deltaY;
  }
}, { passive: false });

/* ---------- keyboard ---------- */
window.addEventListener('keydown', (e) => {
  const step = window.innerWidth * 0.6;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { vp.scrollBy({ left: step, behavior: 'smooth' }); e.preventDefault(); }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { vp.scrollBy({ left: -step, behavior: 'smooth' }); e.preventDefault(); }
  if (e.key === 'Home') vp.scrollTo({ left: 0, behavior: 'smooth' });
  if (e.key === 'End') vp.scrollTo({ left: vp.scrollWidth, behavior: 'smooth' });
});

/* ---------- mouse drag with a little momentum (touch scrolls natively) ---------- */
let down = false, startX = 0, startLeft = 0, lastX = 0, lastT = 0, vel = 0, raf = 0;
vp.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') return;
  down = true; vp.classList.add('dragging');
  startX = lastX = e.clientX; startLeft = vp.scrollLeft; lastT = performance.now(); vel = 0;
  cancelAnimationFrame(raf);
});
window.addEventListener('pointermove', (e) => {
  if (!down) return;
  vp.scrollLeft = startLeft - (e.clientX - startX);
  const t = performance.now();
  vel = (e.clientX - lastX) / Math.max(1, t - lastT);
  lastX = e.clientX; lastT = t;
});
window.addEventListener('pointerup', () => {
  if (!down) return;
  down = false; vp.classList.remove('dragging');
  let v = vel * 16;
  const glide = () => {
    if (Math.abs(v) < 0.5) return;
    vp.scrollLeft -= v; v *= 0.94;
    raf = requestAnimationFrame(glide);
  };
  glide();
});

/* ---------- progress line ---------- */
function progress() {
  const max = vp.scrollWidth - vp.clientWidth;
  bar.style.width = max > 0 ? `${(vp.scrollLeft / max) * 100}%` : '0';
}
vp.addEventListener('scroll', progress, { passive: true });

/* ---------- latent prints: every touch leaves a real-looking thumbprint smudge that fades ----------
   Demo: the "visitor" changes every 15 s, and each visitor's prints come out in their own colour.
   Old prints keep the colour of whoever left them, so several visitors' traces overlap on the glass. */
const COLOURS = ['#4cc9ff', '#ff3df2', '#ffe14d', '#ff3b4e'];
const SWITCH_MS = 15000;                 // how often the visitor (colour) changes
const LIFE = 9000;                       // ms a print stays visible
const glass = document.getElementById('glass');
const g = glass.getContext('2d');
const chip = document.getElementById('visitor');
const marks = [];

function sizeGlass() {
  const d = window.devicePixelRatio || 1;
  glass.width = innerWidth * d; glass.height = innerHeight * d;
  g.setTransform(d, 0, 0, d, 0, 0);
}
sizeGlass(); window.addEventListener('resize', sizeGlass);

/* current visitor */
let visitor = 0, visitorNo = 417;
function setVisitor() {
  chip.style.setProperty('--c', COLOURS[visitor]);
  chip.querySelector('b').textContent = String(visitorNo).padStart(4, '0');
}
setVisitor();
setInterval(() => { visitor = (visitor + 1) % COLOURS.length; visitorNo++; setVisitor(); }, SWITCH_MS);

/* --- procedural fingerprint textures (built once, then tinted per colour) --- */
const TW = 150, TH = 190, VARIANTS = 8;
function rand(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
function makePrint(seed) {
  const r = rand(seed + 1);
  const c = document.createElement('canvas'); c.width = TW; c.height = TH;
  const x = c.getContext('2d'), img = x.createImageData(TW, TH), d = img.data;
  const kind = ['whorl', 'loop', 'loop', 'arch'][Math.floor(r() * 4)];
  const cx = TW / 2 + (r() - .5) * 14, cy = TH * (0.42 + (r() - .5) * .12);
  const period = 4.2 + r() * 1.3;                     // ridge spacing in px
  const ph = Array.from({ length: 8 }, () => r() * 6.283);
  const side = r() < .5 ? -1 : 1, spiral = r() < .4 ? 0 : (r() < .5 ? -1 : 1);   // whole turns only, so no seam
  const warp = (u, v, k) => Math.sin(u * 0.045 + ph[k]) * Math.cos(v * 0.038 + ph[k + 1]);
  for (let py = 0; py < TH; py++) for (let px = 0; px < TW; px++) {
    // fingertip shape: soft oval with an irregular edge
    const ex = (px - TW / 2) / (TW / 2), ey = (py - TH / 2) / (TH / 2);
    let e = Math.sqrt(ex * ex + ey * ey) + 0.07 * warp(px * 3, py * 3, 4);
    if (e > 1) continue;
    // domain warp so ridges wander like real skin
    const u = px - cx + 5 * warp(px, py, 0), v = py - cy + 5 * warp(py, px, 2);
    let phi;
    if (kind === 'whorl') {
      phi = Math.hypot(u * 1.12, v) / period + spiral * Math.atan2(v, u) / 6.283;
    } else if (kind === 'loop') {
      const ut = u + side * 0.35 * Math.max(v, 0);
      const top = Math.hypot(ut, Math.min(v, 0)) / period;
      const arch = (-(v - TH * .3) + 22 * Math.exp(-(u * u) / 900)) / period;
      const w = 1 / (1 + Math.exp(-(v - TH * .18) / 6));
      phi = top * (1 - w) + arch * w;
    } else {
      phi = (-v + 18 * Math.exp(-(u * u) / 1400)) / period;
    }
    let ridge = 0.5 + 0.5 * Math.cos(phi * 6.283);
    ridge = Math.max(0, Math.min(1, (ridge - 0.38) * 3));
    // breaks / pores
    if (Math.sin(px * 1.9 + ph[5]) * Math.sin(py * 2.3 + ph[6]) > 0.86) ridge *= 0.2;
    // pressure: heavier in the middle, patchy, fades to the edge
    const pres = Math.max(0, Math.min(1, (1 - e) * 3.2)) * (0.65 + 0.35 * warp(px * 1.6, py * 1.6, 3));
    const over = Math.max(0, 0.35 - e * 0.5) * (0.5 + 0.5 * warp(px * 2.2, py * 2.2, 6));
    const a = Math.min(1, ridge * pres + over) * (0.78 + 0.22 * r());   // grain
    d[(py * TW + px) * 4 + 3] = a * 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}
const PRINTS = Array.from({ length: VARIANTS }, (_, i) => makePrint(i * 7 + 3));
// tinted copies, with the softness baked in once (per-frame canvas blur is too slow on a kiosk):
// PRINT_TINTS[colour][variant] = { press, smear }
function tint(src, col, blur) {
  const c = document.createElement('canvas'); c.width = TW; c.height = TH;
  const x = c.getContext('2d');
  x.filter = `blur(${blur}px)`;
  x.drawImage(src, 0, 0);
  x.filter = 'none';
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = col; x.fillRect(0, 0, TW, TH);
  return c;
}
const PRINT_TINTS = COLOURS.map((col) => PRINTS.map((p) => ({ press: tint(p, col, 0.5), smear: tint(p, col, 2.2) })));

/* --- record touches --- */
let lastMark = 0, lastPos = null;
function addMark(x, y, kind) {
  const now = performance.now();
  if (kind === 'trail' && now - lastMark < 28) return;
  const ang = lastPos ? Math.atan2(y - lastPos.y, x - lastPos.x) : 0;
  lastMark = now; lastPos = { x, y };
  marks.push({
    x, y, t: now, kind, ang, col: visitor,
    v: Math.floor(Math.random() * VARIANTS),
    rot: (Math.random() - .5) * 0.9,
    s: kind === 'press' ? 0.62 + Math.random() * 0.16 : 0.5 + Math.random() * 0.1,
  });
  if (marks.length > 500) marks.shift();
}
vp.addEventListener('pointerdown', (e) => { lastPos = null; addMark(e.clientX, e.clientY, 'press'); });
vp.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') addMark(e.clientX, e.clientY, 'trail'); });

/* --- draw --- */
function drawPrint(m, a) {
  const tex = PRINT_TINTS[m.col][m.v][m.kind === 'press' ? 'press' : 'smear'];
  g.save();
  g.translate(m.x, m.y);
  if (m.kind === 'press') {
    g.rotate(m.rot);
    g.globalAlpha = a;
    g.drawImage(tex, -TW * m.s / 2, -TH * m.s / 2, TW * m.s, TH * m.s);
  } else {
    // a dragged finger: the print is stretched along the swipe and smeared soft
    g.rotate(m.ang + Math.PI / 2);
    g.globalAlpha = a;
    g.drawImage(tex, -TW * m.s / 2, -TH * m.s * 0.8, TW * m.s, TH * m.s * 1.6);
  }
  g.restore();
}
function loop(now) {
  g.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = 0; i < marks.length; i++) {
    const age = (now - marks[i].t) / LIFE;
    if (age >= 1) { marks.splice(i--, 1); continue; }
    drawPrint(marks[i], Math.pow(1 - age, 1.6) * (marks[i].kind === 'press' ? 0.9 : 0.15));
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
