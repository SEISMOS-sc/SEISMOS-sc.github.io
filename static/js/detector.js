/* SEISMOS detector, as in Algorithm 2 of the paper, run on a synthetic
   similarity signal so the page can show it working live.
   Exposed as window.Seismos for the page and for a quick Node check. */
(function (root) {
  "use strict";

  function rng(seed) {
    // mulberry32: small seeded PRNG, so a given seed always draws the same document
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(r) {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Synthetic document: AR(1) similarity noise around a per-topic baseline,
  // sharp bilateral dips at planted topic shifts, and one broad shallow trough
  // (a gradual drift that should NOT be split).
  function synthDocument(seed, opts) {
    const o = Object.assign({ n: 72, rho: 0.3, sigma: 0.035, shifts: 4 }, opts || {});
    const r = rng(seed);
    const m = o.n - 1; // number of similarities x_1..x_{n-1}
    const planted = [];
    const minGap = 9;
    let guard = 0;
    while (planted.length < o.shifts && guard++ < 500) {
      const p = 6 + Math.floor(r() * (m - 12));
      if (planted.every((q) => Math.abs(q - p) >= minGap)) planted.push(p);
    }
    planted.sort((a, b) => a - b);

    // broad trough placed away from planted shifts
    let trough = -1;
    guard = 0;
    while (guard++ < 200) {
      const c = 5 + Math.floor(r() * (m - 10));
      if (planted.every((q) => Math.abs(q - c) >= 6)) { trough = c; break; }
    }

    const x = new Array(m);
    let e = 0;
    let seg = 0;
    let base = 0.7 + r() * 0.12;
    for (let j = 0; j < m; j++) {
      e = o.rho * e + Math.sqrt(1 - o.rho * o.rho) * o.sigma * gauss(r);
      if (seg < planted.length && j === planted[seg]) {
        x[j] = base - (0.28 + r() * 0.16) + e * 0.5;
        seg++;
        base = 0.66 + r() * 0.16;
        continue;
      }
      let v = base + e;
      if (trough >= 0) {
        const d = Math.abs(j - trough);
        if (d <= 3) v -= 0.085 * (1 - d / 4);
      }
      x[j] = v;
    }
    return { x: x.map((v) => Math.max(-1, Math.min(1, v))), planted, trough };
  }

  function std(a) {
    const mu = a.reduce((s, v) => s + v, 0) / a.length;
    return Math.sqrt(a.reduce((s, v) => s + (v - mu) * (v - mu), 0) / a.length);
  }

  // Algorithm 2: discrete Laplacian, self-normalised by std(D), split where t_i > k.
  // x is 0-indexed: x[j] = cos(e_j, e_{j+1}). D and t are defined for j = 1..m-2.
  function detect(x, k) {
    const m = x.length;
    const D = new Array(m).fill(null);
    const vals = [];
    for (let j = 1; j <= m - 2; j++) {
      D[j] = x[j + 1] - 2 * x[j] + x[j - 1];
      vals.push(D[j]);
    }
    const s = m + 1 >= 5 ? std(vals) : 0;
    const t = D.map((d) => (d === null || s === 0 ? null : d / s));
    const boundaries = [];
    for (let j = 1; j <= m - 2; j++) if (t[j] !== null && t[j] > k) boundaries.push(j);
    return { D, t, s, sigma: std(x), boundaries };
  }

  // One-sided Gaussian tail Pr(Z > z), Abramowitz-Stegun 7.1.26 erf approximation
  function tail(z) {
    const xx = z / Math.SQRT2;
    const tt = 1 / (1 + 0.3275911 * Math.abs(xx));
    const y = 1 - ((((1.061405429 * tt - 1.453152027) * tt + 1.421413741) * tt - 0.284496736) * tt + 0.254829592) * tt * Math.exp(-xx * xx);
    const erf = xx >= 0 ? y : -y;
    return 0.5 * (1 - erf);
  }

  root.Seismos = { synthDocument, detect, tail, std };
  if (typeof module !== "undefined") module.exports = root.Seismos;
})(typeof window !== "undefined" ? window : globalThis);
