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
  if (sheetOpen()) { if (e.key === 'Escape') closeInfo(); return; }
  const tap = e.target.closest && e.target.closest('[data-info]');
  if (tap && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openInfo(tap.dataset.info, tap, true); return; }
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

/* ---------- info panel: tapping an element with data-info="name" opens <section id="info-name"> ---------- */
const sheet = document.getElementById('sheet');
const panel = sheet.querySelector('.sheet-panel');
const closeBtn = sheet.querySelector('.sheet-close');
let opener = null;

function sheetOpen() { return sheet.classList.contains('open'); }
function openInfo(name, from, viaKeyboard) {
  const sec = document.getElementById('info-' + name);
  if (!sec) return;
  sheet.querySelectorAll('.info').forEach((s) => { s.hidden = s !== sec; });
  panel.setAttribute('aria-label', sec.querySelector('.info-title').textContent);
  panel.scrollTop = 0;
  opener = from || null;
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  if (viaKeyboard) closeBtn.focus({ preventScroll: true });
}
function closeInfo() {
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  if (opener && document.activeElement && sheet.contains(document.activeElement)) opener.focus({ preventScroll: true });
  opener = null;
}
sheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeInfo(); });

// a tap opens the panel; a drag/swipe to scroll does not
let tapX = 0, tapY = 0, tapMoved = false;
vp.addEventListener('pointerdown', (e) => { tapX = e.clientX; tapY = e.clientY; tapMoved = false; });
vp.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - tapX, e.clientY - tapY) > 10) tapMoved = true; });
vp.addEventListener('click', (e) => {
  if (tapMoved) return;
  const t = e.target.closest('[data-info]');
  if (t) openInfo(t.dataset.info, t, false);
});

/* ---------- latent prints on the glass ----------
   Every touch leaves a thumbprint that fades. The prints are made from real
   fingerprint photos (img/prints/, built from img/fingerprint reference *.jpg).
   - The current visitor's taps and swipes come out in one colour, picked at
     random and changed every 15 s.
   - Every 10 s, fainter prints and swipe marks left by earlier "visitors"
     surface in other colours, so several people's traces overlap. */
const COLOURS = ['#4cc9ff', '#ff3df2', '#ffe14d', '#ff3b4e'];
const SWITCH_MS = 15000;                 // how often the current visitor (colour) changes
const GHOST_MS = 10000;                  // how often earlier visitors' traces appear
const LIFE = 9000;                       // ms a print stays visible
const PRINT_H = 0.115;                   // print height, as a share of the screen height
const PRINT_SRC = ['img/prints/print-1.png', 'img/prints/print-2.png', 'img/prints/print-3.png'];
const glass = document.getElementById('glass');
const g = glass.getContext('2d');
const marks = [];

function sizeGlass() {
  const d = window.devicePixelRatio || 1;
  glass.width = innerWidth * d; glass.height = innerHeight * d;
  g.setTransform(d, 0, 0, d, 0, 0);
  g.imageSmoothingQuality = 'high';
}
sizeGlass(); window.addEventListener('resize', sizeGlass);

/* colours: a random one for the current visitor, different ones for earlier visitors */
function pickColour(avoid) {
  const free = COLOURS.map((_, i) => i).filter((i) => !avoid.includes(i));
  const from = free.length ? free : COLOURS.map((_, i) => i);
  return from[Math.floor(Math.random() * from.length)];
}
let visitor = pickColour([]);
setInterval(() => { visitor = pickColour([visitor]); }, SWITCH_MS);

/* --- fingerprint textures: each photo, plus a mirrored copy --- */
const BASES = [];
PRINT_SRC.forEach((src) => {
  const im = new Image();
  im.onload = () => {
    for (const flip of [1, -1]) {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d');
      if (flip < 0) { x.translate(c.width, 0); x.scale(-1, 1); }
      x.drawImage(im, 0, 0);
      BASES.push(c);
    }
  };
  im.src = src;
});

// Tinted versions are built on first use and cached (blurring per frame is too slow on a kiosk).
//   press — a fingertip pressed on the glass, with uneven pressure (p picks where it pressed hardest)
//   smear — the same fingertip dragged, its ridges streaked into lines
const PRESSURE = [[0, 0.05], [-0.22, 0.18], [0.2, -0.12]];
const texCache = new Map();
function texture(b, col, kind, p) {
  const key = `${b}|${col}|${kind}|${p}`;
  let c = texCache.get(key);
  if (c) return c;
  const src = BASES[b], w = src.width, h = src.height;
  c = document.createElement('canvas');
  const x = c.getContext('2d');
  if (kind === 'press') {
    c.width = w; c.height = h;
    x.filter = 'blur(0.35px)';
    x.drawImage(src, 0, 0);
    x.filter = 'none';
    // pressure: full where the finger pressed hardest, fading towards the far edge
    const [ox, oy] = PRESSURE[p];
    const gr = x.createRadialGradient(w * (0.5 + ox), h * (0.5 + oy), 0, w * (0.5 + ox), h * (0.5 + oy), Math.max(w, h) * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,.12)');
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
  } else {
    // a slice across the middle of the print, stretched along the swipe: each ridge the
    // finger drags leaves a thin oily streak, so a swipe reads as fine parallel lines
    c.width = w; c.height = h;
    x.filter = 'blur(0.5px)';
    x.drawImage(src, 0, Math.floor(h * 0.45), w, 3, 0, 0, w, h);
    x.globalAlpha = 0.5;
    x.drawImage(src, 0, Math.floor(h * 0.62), w, 3, 0, 0, w, h);
    x.filter = 'none'; x.globalAlpha = 1;
    // fade out at both ends and towards the sides of the fingertip
    x.globalCompositeOperation = 'destination-in';
    const along = x.createLinearGradient(0, 0, 0, h);
    along.addColorStop(0, 'rgba(0,0,0,0)'); along.addColorStop(0.3, 'rgba(0,0,0,1)');
    along.addColorStop(0.7, 'rgba(0,0,0,1)'); along.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = along; x.fillRect(0, 0, w, h);
    const across = x.createLinearGradient(0, 0, w, 0);
    across.addColorStop(0, 'rgba(0,0,0,0)'); across.addColorStop(0.25, 'rgba(0,0,0,1)');
    across.addColorStop(0.75, 'rgba(0,0,0,1)'); across.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = across; x.fillRect(0, 0, w, h);
  }
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = COLOURS[col]; x.fillRect(0, 0, c.width, c.height);
  // faint oily haze around the ridges, like skin oil on glass
  x.globalCompositeOperation = 'destination-over';
  const hz = x.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, Math.max(c.width, c.height) / 2);
  hz.addColorStop(0, COLOURS[col] + '1f'); hz.addColorStop(1, COLOURS[col] + '00');
  x.fillStyle = hz; x.fillRect(0, 0, c.width, c.height);
  texCache.set(key, c);
  return c;
}

/* --- marks --- */
function makeMark(x, y, kind, col, t, strength, b, ang = 0) {
  return {
    x, y, kind, col, t, strength, ang, b,
    p: Math.floor(Math.random() * PRESSURE.length),
    rot: (Math.random() - 0.5) * 0.9,
    s: kind === 'press' ? 0.88 + Math.random() * 0.24 : 0.8 + Math.random() * 0.1,
  };
}
function pushMark(m) { marks.push(m); if (marks.length > 900) marks.shift(); }
const randomBase = () => Math.floor(Math.random() * BASES.length);

// the current visitor's touches (one finger = one print pattern for the whole stroke)
let lastMark = 0, lastPos = null, strokeBase = 0;
function addMark(x, y, kind) {
  if (!BASES.length) return;
  const now = performance.now();
  if (kind === 'press') { strokeBase = randomBase(); lastPos = null; }
  if (kind === 'trail') {
    if (now - lastMark < 24) return;
    if (lastPos && Math.hypot(x - lastPos.x, y - lastPos.y) < 4) return;
  }
  const ang = lastPos ? Math.atan2(y - lastPos.y, x - lastPos.x) : 0;
  lastMark = now; lastPos = { x, y };
  pushMark(makeMark(x, y, kind, visitor, now, 1, strokeBase % Math.max(1, BASES.length), ang));
}
window.addEventListener('pointerdown', (e) => addMark(e.clientX, e.clientY, 'press'));
window.addEventListener('pointermove', (e) => { if (e.buttons && e.pointerType !== 'touch') addMark(e.clientX, e.clientY, 'trail'); });
// touch: the browser takes over scrolling (pointer events stop), but touchmove keeps reporting the finger
window.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) addMark(t.clientX, t.clientY, 'trail'); }, { passive: true });

// earlier visitors: fainter prints and swipe marks in colours other than the current visitor's
function ghostSwipe(col, b, t0) {
  let x = innerWidth * (0.12 + Math.random() * 0.76);
  let y = innerHeight * (0.18 + Math.random() * 0.64);
  let a = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.5;   // mostly sideways, like scrolling
  const len = innerWidth * (0.14 + Math.random() * 0.24);
  const bend = (Math.random() - 0.5) * 0.7, step = 10;
  pushMark(makeMark(x, y, 'press', col, t0, 0.3, b));
  for (let d = 0, i = 0; d < len; d += step, i++) {
    a += bend * step / len;
    x += Math.cos(a) * step; y += Math.sin(a) * step;
    pushMark(makeMark(x, y, 'trail', col, t0 + i * 14, 0.45, b, a));   // drawn in over ~1 s, like a finger moving
  }
}
function ghostVisit() {
  if (!BASES.length || document.hidden) return;
  const now = performance.now();
  const used = [visitor];
  const people = Math.random() < 0.5 ? 1 : 2;
  for (let k = 0; k < people; k++) {
    const col = pickColour(used); used.push(col);
    const b = randomBase(), t0 = now + k * 700;
    const presses = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < presses; i++) {
      pushMark(makeMark(innerWidth * (0.08 + Math.random() * 0.84), innerHeight * (0.12 + Math.random() * 0.76),
        'press', col, t0 + i * 350, 0.42, b));
    }
    if (Math.random() < 0.8) ghostSwipe(col, b, t0 + 250);
  }
}
setInterval(ghostVisit, GHOST_MS);

/* --- draw --- */
function drawMark(m, a) {
  const base = BASES[m.b];
  if (!base) return;
  const press = m.kind === 'press';
  const tex = texture(m.b, m.col, press ? 'press' : 'smear', m.p);
  const h = innerHeight * PRINT_H * m.s, w = h * base.width / base.height;
  g.save();
  g.translate(m.x, m.y);
  g.globalAlpha = a;
  if (press) {
    g.rotate(m.rot);
    g.drawImage(tex, -w / 2, -h / 2, w, h);
  } else {
    // a dragged finger: streaks laid along the swipe; overlapping stamps join into one smear
    g.rotate(m.ang - Math.PI / 2);
    g.drawImage(tex, -w * 0.375, -h / 2, w * 0.75, h);
  }
  g.restore();
}
function loop(now) {
  g.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i], age = (now - m.t) / LIFE;
    if (age >= 1) { marks.splice(i--, 1); continue; }
    if (age < 0) continue;                       // not drawn in yet
    drawMark(m, Math.pow(1 - age, 1.6) * (m.kind === 'press' ? 0.9 : 0.07) * m.strength);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
