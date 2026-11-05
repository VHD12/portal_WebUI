/*
 * Portal interaction — camera orbit
 * The portal is fixed in the world. Scroll orbits the camera around it on a circle:
 *   world   — rotates about the portal centre, so the portal turns from tilted to front-on
 *             and the far background swings across, revealing its left side
 *   bg      — sits far behind (translateZ), so it slides slower; it also turns less
 *             than the portal by counter-rotating part of the orbit
 *   inside  — the portal's crop is the background seen along the camera's line of sight,
 *             magnified, so it slides against the outer scene like looking through glass
 * Then it rests front-on, white floods the pane from its glowing edges, and the camera
 * moves forward through the door into the next section.
 */

const CONFIG = {
  imageRatio: 3200 / 2133,      // assets/scene-hd.jpg — Monument Valley, Gantavya Bhatt / Unsplash
  imageHorizon: 0.48,         // horizon line as a fraction of image height
  smoothing: 0.085,           // 0..1, lower = floatier

  perspective: 900,           // px — camera lens
  orbit: [34, 0],             // deg — camera angle around the portal, start → end
  depth: 520,                 // px — how far the background sits behind the portal
  bgTurn: 0.35,               // 0..1 — share of the orbit the background plane shows
  bgPan: [-380, 0],           // px — extra sideways travel of the background, start → end
                              //      (more negative = more of the left revealed)

  sun: [0.35, 1],             // glint + light on the land, start → end

  // scroll timeline (fractions of the whole track)
  phases: {
    orbit: [0, 0.45],         // camera comes round, edges start to glow
    enter: [0.55, 1],         // (rest between) then white floods in and we go through the door
  },

  glow: {
    depth: 0.2,               // how far the edge glow reaches in once front-on (× portal width)
    fill: [0.25, 0.85],       // share of the enter phase spent flooding to white
    dolly: [0.05, 1],         // share of the enter phase spent moving through the door
    bloom: [0.35, 1],         // outer shine: strength at rest front-on → fully inside
  },

  copy: {
    rise: [0, 0.75],          // share of the enter phase over which the text lifts away
    lift: 0.7,                // how far it travels (× viewport height)
  },

  inside: {
    zoom: 1.2,                // portal shows the scene magnified
    horizon: 0.55,            // where the horizon sits in the pane (fraction of height)
  },
};

const $ = (s) => document.querySelector(s);
const track = $('.track');
const viewports = document.querySelectorAll('.viewport');   // scene + light layer share one camera
const worlds = document.querySelectorAll('.world');
const bg = $('.bg');
const bgImg = $('.bg-img');
const portal = $('.portal');
const portalImgs = document.querySelectorAll('.portal-img');
const glints = document.querySelectorAll('.portal-glint');
const glow = $('.portal-glow');
const whiteout = $('.whiteout');
const bloom = $('.portal-bloom');
const lifts = document.querySelectorAll('.copy, .blurb');
const shade = $('.shade');
const cast = $('.cast');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const DEG = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeIn = (t) => t * t;
const span = (p, [a, b]) => clamp01((p - a) / (b - a));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

let size = {};

// The bg plane in camera space for a camera angle theta (rad) and pan (px):
// its origin (ox, oz) after the world turns, and phi, the angle it shows.
function bgPlane(theta, pan) {
  const D = CONFIG.depth;
  return {
    phi: theta * CONFIG.bgTurn,
    ox: pan * Math.cos(theta) - D * Math.sin(theta),
    oz: -pan * Math.sin(theta) - D * Math.cos(theta),
  };
}
let target = 0;
let current = 0;

// Cover: trace the screen's left and right edges onto the bg plane at every point of the
// orbit, so no edge of the image is ever seen. Camera sits at z = P from the pivot.
// Returns the image size and its offset along the plane.
function cover(vw, vh, cx, cy, panRange) {
  const { perspective: P, orbit, imageRatio, imageHorizon } = CONFIG;
  let tMin = Infinity, tMax = -Infinity, needUp = 0, needDown = 0;
  for (let i = 0; i <= 20; i++) {
    const theta = lerp(orbit[0], orbit[1], i / 20) * DEG;
    const { phi, ox, oz } = bgPlane(theta, lerp(panRange[0], panRange[1], i / 20));
    for (const xs of [0, vw]) {
      const a = xs - cx;
      const t = (ox - (a * (P - oz)) / P) / ((a * Math.sin(phi)) / P - Math.cos(phi));
      const depth = P - (oz - t * Math.sin(phi));   // camera → plane distance on this ray
      tMin = Math.min(tMin, t);
      tMax = Math.max(tMax, t);
      needUp = Math.max(needUp, (cy * depth) / P);
      needDown = Math.max(needDown, ((vh - cy) * depth) / P);
    }
  }
  // centre the image on the swept band
  const needW = (tMax - tMin) * 1.03;
  const needH = Math.max(needUp / imageHorizon, needDown / (1 - imageHorizon)) * 1.03;
  const W = Math.max(needW, needH * imageRatio);
  return { offX: (tMin + tMax) / 2, W, H: W / imageRatio };
}

function measure() {
  const { perspective: P, depth: D, imageRatio, imageHorizon } = CONFIG;
  const vw = window.innerWidth;
  const vh = $('.stage').clientHeight;
  const cs = getComputedStyle(portal);
  const pw = parseFloat(cs.width);
  const ph = parseFloat(cs.height);
  const root = getComputedStyle(document.documentElement);
  const cx = vw * parseFloat(root.getPropertyValue('--px')) / 100;
  const cy = vh * parseFloat(root.getPropertyValue('--py')) / 100;

  viewports.forEach((v) => { v.style.perspective = `${P}px`; });

  // world units per screen px at the background's depth
  const k = (P + D) / P;

  const bgFit = cover(vw, vh, cx, cy, CONFIG.bgPan);
  const { offX, W, H } = bgFit;

  bgImg.style.width = `${W}px`;
  bgImg.style.height = `${H}px`;
  bgImg.style.marginLeft = `${-W / 2 + offX}px`;
  bgImg.style.marginTop = `${-H * imageHorizon}px`;

  // inside the pane: the background at its on-screen scale, magnified. Sized as if the
  // background had no pan, so the pan only moves the outside scene, never the portal's view.
  const inFit = cover(vw, vh, cx, cy, [0, 0]);
  const Wi = (inFit.W / k) * CONFIG.inside.zoom;
  const Hi = Wi / imageRatio;
  portalImgs.forEach((img) => {
    img.style.width = `${Wi}px`;
    img.style.height = `${Hi}px`;
  });

  // how much the portal must grow to cover the screen (its rounded corners included)
  const fillScale = 1.25 * Math.max(cx / (pw / 2), (vw - cx) / (pw / 2), cy / (ph / 2), (vh - cy) / (ph / 2));

  size = { vh, pw, ph, inW: inFit.W, inOffX: inFit.offX, Wi, Hi, fillScale };
}

function readScroll() {
  const max = track.offsetHeight - size.vh;
  target = clamp01(-track.getBoundingClientRect().top / max);
}

function render(p) {
  const { perspective: P, depth: D, bgTurn, imageHorizon, phases } = CONFIG;
  const { pw, ph, inW, inOffX, Wi, Hi, fillScale } = size;

  const t = easeInOut(span(p, phases.orbit));        // orbit
  const e = span(p, phases.enter);                   // entering the door
  const fill = easeInOut(span(e, CONFIG.glow.fill));  // white floods edges → centre
  const dolly = easeIn(span(e, CONFIG.glow.dolly));   // 0..1 through the door

  const theta = lerp(CONFIG.orbit[0], CONFIG.orbit[1], t);   // camera angle
  const phi = theta * bgTurn;                                 // what the bg plane shows

  // camera orbit = the world turning about the portal
  // then the camera moves forward through it. Growth is exponential in scale (the same
  // zoom rate all the way) — moving z linearly would bunch the whole zoom into the end.
  const grow = Math.pow(fillScale, dolly);
  const z = P * (1 - 1 / grow);
  worlds.forEach((w) => { w.style.transform = `translateZ(${z}px) rotateY(${theta}deg)`; });

  // background: pushed back, and partly un-turned so it rotates less than the portal
  // and panned sideways for extra travel
  const pan = lerp(CONFIG.bgPan[0], CONFIG.bgPan[1], t);
  bg.style.transform = `translate3d(${pan}px, 0, ${-D}px) rotateY(${phi - theta}deg)`;

  // inside: where the camera's line of sight through the portal centre hits the bg plane
  const along = (D * Math.sin(theta * DEG)) / Math.cos(phi * DEG); // world px along the plane
  const u = 0.5 + (along - inOffX) / inW;
  const ix = pw / 2 - u * Wi;
  const iy = ph * CONFIG.inside.horizon - imageHorizon * Hi;
  portalImgs.forEach((img) => { img.style.transform = `translate3d(${ix}px, ${iy}px, 0)`; });

  // sun: the mirror catches it more as it turns to face you, and throws more onto the land
  const sun = lerp(CONFIG.sun[0], CONFIG.sun[1], t);
  glints.forEach((g) => { g.style.opacity = sun.toFixed(3); });
  cast.style.opacity = (sun * (1 - dolly)).toFixed(3);

  // glowing door edges: a white inner shadow that reaches further in as the portal comes
  // round, then floods the whole pane from the edges to the centre
  const reach = CONFIG.glow.depth * pw * t;                // ~20% in once front-on
  const blur = lerp(reach, pw * 0.35, fill);
  const spread = lerp(reach * 0.15, Math.max(pw, ph) * 0.6, fill);
  const alpha = Math.max(t * 0.9, fill);
  glow.style.boxShadow = t + fill > 0
    ? `inset 0 0 ${blur.toFixed(1)}px ${spread.toFixed(1)}px rgba(255, 255, 255, ${alpha.toFixed(3)})`
    : 'none';
  glow.style.backgroundColor = `rgba(255, 255, 255, ${(fill * fill).toFixed(3)})`;

  // shine spilling out around the door: there at rest, swelling as we go in
  const shine = t * lerp(CONFIG.glow.bloom[0], CONFIG.glow.bloom[1], easeInOut(span(e, [0, 0.9])));
  const reachOut = pw * lerp(0.12, 0.7, shine);
  bloom.style.boxShadow = shine > 0
    ? `0 0 ${reachOut.toFixed(1)}px ${(reachOut * 0.12).toFixed(1)}px rgba(255, 255, 255, ${(shine * 0.85).toFixed(3)}),` +
      ` 0 0 ${(reachOut * 2.4).toFixed(1)}px ${(reachOut * 0.3).toFixed(1)}px rgba(255, 244, 228, ${(shine * 0.45).toFixed(3)})`
    : 'none';

  // text and CTAs lift away behind the door as we go in, fading only near the top
  const rise = easeInOut(span(e, CONFIG.copy.rise));
  lifts.forEach((el) => {
    el.style.transform = `translate3d(0, ${(-rise * CONFIG.copy.lift * size.vh).toFixed(1)}px, 0)`;
    el.style.opacity = (1 - span(rise, [0.45, 1])).toFixed(3);
  });
  shade.style.opacity = (1 - rise).toFixed(3);

  // the screen ends pure white
  whiteout.style.opacity = span(e, [0.85, 1]).toFixed(3);
}

function tick() {
  const k = reduceMotion.matches ? 1 : CONFIG.smoothing;
  current += (target - current) * k;
  if (Math.abs(target - current) < 0.0001) current = target;
  render(current);
  requestAnimationFrame(tick);
}

function onResize() {
  measure();
  readScroll();
  render(current);
}

window.addEventListener('scroll', readScroll, { passive: true });
window.addEventListener('resize', onResize);

onResize();
current = target;
render(current);
requestAnimationFrame(tick);
