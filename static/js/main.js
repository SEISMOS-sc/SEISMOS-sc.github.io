(function () {
  "use strict";
  const S = window.Seismos;
  const css = getComputedStyle(document.documentElement);
  const C = (name) => css.getPropertyValue(name).trim();
  const COL = {
    ink: C("--ink"), ink2: C("--ink-2"), ink3: C("--ink-3"), rule: C("--rule"), ruleStrong: C("--rule-strong"),
    signal: C("--signal"), signalWash: C("--signal-wash"), detect: C("--detect"), detectWash: C("--detect-wash"),
    lavender: C("--lavender"), paper: C("--paper"), mono: C("--f-mono") || "monospace",
  };
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setupCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /* ---------------- hero seismograph strip ---------------- */
  (function heroTrace() {
    const canvas = document.getElementById("trace");
    if (!canvas || !S) return;
    // a ring of concatenated synthetic documents, detected with the paper's rule (k = 2.5)
    let x = [];
    [101, 102, 103, 104, 105, 106].forEach((seed) => { x = x.concat(S.synthDocument(seed, { n: 64 }).x); });
    const L = x.length;
    const at = (i) => x[((i % L) + L) % L];
    const D = x.map((_, i) => at(i + 1) - 2 * at(i) + at(i - 1));
    const sD = S.std(D);
    const t = D.map((d) => d / sD);
    const K = 2.5;

    let offset = 0, last = 0, visible = true, raf = 0;

    function draw() {
      const { ctx, w, h } = setupCanvas(canvas);
      ctx.clearRect(0, 0, w, h);
      const step = w < 600 ? 6 : 8;
      const n = Math.ceil(w / step) + 3;
      const top = 14, bot = h - 12;
      const y = (v) => bot - ((v - 0.15) / (0.95 - 0.15)) * (bot - top);
      const base = Math.floor(offset);
      const frac = offset - base;

      // faint grid
      ctx.strokeStyle = COL.rule;
      ctx.lineWidth = 1;
      [0.3, 0.55, 0.8].forEach((g) => {
        ctx.beginPath(); ctx.moveTo(0, Math.round(y(g)) + 0.5); ctx.lineTo(w, Math.round(y(g)) + 0.5); ctx.stroke();
      });

      // boundaries first, so the trace sits on top
      for (let j = 0; j < n; j++) {
        const i = base + j;
        const ii = ((i % L) + L) % L;
        if (t[ii] > K && at(i) < at(i - 1) && at(i) < at(i + 1)) {
          const px = (j - frac) * step;
          ctx.fillStyle = COL.detectWash;
          ctx.fillRect(px - step * 0.6, 0, step * 1.2, h);
          ctx.strokeStyle = COL.detect;
          ctx.globalAlpha = 0.55;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(Math.round(px) + 0.5, 0); ctx.lineTo(Math.round(px) + 0.5, h); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.fillStyle = COL.detect;
          ctx.font = "500 10.5px " + COL.mono;
          const label = "t=" + t[ii].toFixed(1);
          const tw = ctx.measureText(label).width;
          const lx = Math.min(Math.max(px + 6, 4), w - tw - 4);
          ctx.fillText(label, lx, top + 2);
        }
      }

      // trace
      ctx.strokeStyle = COL.signal;
      ctx.lineWidth = 1.7;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        const px = (j - frac) * step, py = y(at(base + j));
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();

      // valley dots
      for (let j = 0; j < n; j++) {
        const i = base + j;
        const ii = ((i % L) + L) % L;
        if (t[ii] > K && at(i) < at(i - 1) && at(i) < at(i + 1)) {
          const px = (j - frac) * step;
          ctx.fillStyle = COL.paper;
          ctx.beginPath(); ctx.arc(px, y(at(i)), 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = COL.detect;
          ctx.beginPath(); ctx.arc(px, y(at(i)), 3.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    function loop(ts) {
      if (!visible) { raf = 0; return; }
      const dt = last ? Math.min(ts - last, 64) : 16;
      last = ts;
      offset += dt * 0.0042;
      draw();
      raf = requestAnimationFrame(loop);
    }

    draw();
    if (!reduceMotion) {
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => {
          visible = entries[0].isIntersecting;
          if (visible && !raf) { last = 0; raf = requestAnimationFrame(loop); }
        }).observe(canvas);
      } else {
        raf = requestAnimationFrame(loop);
      }
    }
    window.addEventListener("resize", draw);
  })();

  /* ---------------- detector playground ---------------- */
  (function playground() {
    const canvas = document.getElementById("lab-canvas");
    if (!canvas || !S) return;
    const slider = document.getElementById("k-slider");
    const kOut = document.getElementById("k-out");
    const btnNew = document.getElementById("lab-new");
    const btnReset = document.getElementById("lab-reset");
    const out = {
      tail: document.getElementById("ro-tail"),
      found: document.getElementById("ro-found"),
      rec: document.getElementById("ro-rec"),
      fp: document.getElementById("ro-fp"),
    };
    const DEFAULT_SEED = 34;
    let seed = DEFAULT_SEED;
    let doc = S.synthDocument(seed);

    function render() {
      const k = parseFloat(slider.value);
      kOut.value = k.toFixed(1);
      kOut.textContent = k.toFixed(1);
      const r = S.detect(doc.x, k);
      const m = doc.x.length;

      const near = (b) => doc.planted.some((p) => Math.abs(p - b) <= 1);
      const recovered = doc.planted.filter((p) => r.boundaries.some((b) => Math.abs(p - b) <= 1)).length;
      const falseSplits = r.boundaries.filter((b) => !near(b)).length;
      const tailP = S.tail(k) * 100;
      out.tail.textContent = (tailP < 0.1 ? tailP.toFixed(2) : tailP.toFixed(1)) + "%";
      out.found.textContent = r.boundaries.length;
      out.rec.textContent = recovered + " / " + doc.planted.length;
      out.rec.className = recovered === doc.planted.length ? "ok" : "warn";
      out.fp.textContent = falseSplits;
      out.fp.className = falseSplits === 0 ? "ok" : "warn";

      const { ctx, w, h } = setupCanvas(canvas);
      ctx.clearRect(0, 0, w, h);
      const padL = w < 520 ? 34 : 46, padR = 14;
      const split = Math.round(h * 0.56);
      const p1 = { top: 26, bot: split - 26 };
      const p2 = { top: split + 22, bot: h - 30 };
      const X = (i) => padL + (i / (m - 1)) * (w - padL - padR);

      // ---- top panel: similarity signal with chunk bands
      let lo = Math.min.apply(null, doc.x), hi = Math.max.apply(null, doc.x);
      lo = Math.floor((lo - 0.04) * 10) / 10; hi = Math.min(1, Math.ceil((hi + 0.02) * 10) / 10);
      const Y1 = (v) => p1.bot - ((v - lo) / (hi - lo)) * (p1.bot - p1.top);

      const cuts = [-0.5].concat(r.boundaries, [m - 0.5]);
      for (let c = 0; c < cuts.length - 1; c++) {
        const a = X(Math.max(0, cuts[c])), b = X(Math.min(m - 1, cuts[c + 1]));
        ctx.fillStyle = c % 2 ? COL.lavender : COL.signalWash;
        ctx.fillRect(a, p1.top, b - a, p1.bot - p1.top);
      }

      ctx.font = "11px " + COL.mono;
      ctx.fillStyle = COL.ink3;
      ctx.strokeStyle = COL.rule;
      ctx.lineWidth = 1;
      for (let g = Math.ceil(lo * 10) / 10; g <= hi + 1e-9; g += 0.1) {
        const yy = Math.round(Y1(g)) + 0.5;
        ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
        ctx.fillText(g.toFixed(1), 2, yy + 4);
      }
      ctx.fillStyle = COL.ink2;
      ctx.font = "600 11px " + COL.mono;
      ctx.fillText("xᵢ = cos(eᵢ, eᵢ₊₁)   chunks shaded", padL, 14);

      // planted shifts (triangles under the panel)
      ctx.fillStyle = COL.ink3;
      doc.planted.forEach((p) => {
        const px = X(p);
        ctx.beginPath(); ctx.moveTo(px, p1.bot + 3); ctx.lineTo(px - 5, p1.bot + 11); ctx.lineTo(px + 5, p1.bot + 11); ctx.closePath(); ctx.fill();
      });

      // gradual trough label
      if (doc.trough >= 0 && !r.boundaries.some((b) => Math.abs(b - doc.trough) <= 3)) {
        ctx.fillStyle = COL.ink3;
        ctx.font = "italic 11px " + COL.mono;
        const tx = X(doc.trough);
        const label = "gradual trough: no split";
        const tw = ctx.measureText(label).width;
        ctx.fillText(label, Math.min(Math.max(tx - tw / 2, padL), w - padR - tw), p1.bot - 8);
      }

      // boundaries
      r.boundaries.forEach((b) => {
        const px = Math.round(X(b)) + 0.5;
        ctx.strokeStyle = COL.detect;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(px, p1.top); ctx.lineTo(px, p2.bot); ctx.stroke();
        ctx.setLineDash([]);
      });

      ctx.strokeStyle = COL.signal;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";
      ctx.beginPath();
      doc.x.forEach((v, i) => (i ? ctx.lineTo(X(i), Y1(v)) : ctx.moveTo(X(i), Y1(v))));
      ctx.stroke();
      doc.x.forEach((v, i) => {
        const isB = r.boundaries.indexOf(i) >= 0;
        ctx.fillStyle = isB ? COL.detect : COL.signal;
        ctx.beginPath(); ctx.arc(X(i), Y1(v), isB ? 4 : 1.8, 0, Math.PI * 2); ctx.fill();
      });

      // ---- bottom panel: t_i stems vs threshold k
      const tv = r.t.filter((v) => v !== null);
      const tLo = Math.min(-2, Math.floor(Math.min.apply(null, tv)));
      const tHi = Math.max(5.5, Math.ceil(Math.max.apply(null, tv)));
      const Y2 = (v) => p2.bot - ((v - tLo) / (tHi - tLo)) * (p2.bot - p2.top);
      ctx.fillStyle = COL.ink2;
      ctx.font = "600 11px " + COL.mono;
      ctx.fillText("tᵢ = Dᵢ / ŝ_D   split where tᵢ > k", padL, p2.top - 8);
      ctx.font = "11px " + COL.mono;
      ctx.fillStyle = COL.ink3;
      ctx.strokeStyle = COL.rule;
      ctx.lineWidth = 1;
      for (let g = tLo; g <= tHi; g += 2) {
        const yy = Math.round(Y2(g)) + 0.5;
        ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
        ctx.fillText(String(g), 8, yy + 4);
      }
      const y0 = Y2(0);
      ctx.strokeStyle = COL.ruleStrong;
      ctx.beginPath(); ctx.moveTo(padL, Math.round(y0) + 0.5); ctx.lineTo(w - padR, Math.round(y0) + 0.5); ctx.stroke();

      const bw = Math.max(2, Math.min(6, (w - padL - padR) / m - 2));
      r.t.forEach((v, i) => {
        if (v === null) return;
        const over = v > k;
        ctx.fillStyle = over ? COL.detect : COL.ruleStrong;
        const yv = Y2(v);
        ctx.fillRect(X(i) - bw / 2, Math.min(y0, yv), bw, Math.abs(yv - y0));
      });

      const yk = Math.round(Y2(k)) + 0.5;
      ctx.strokeStyle = COL.detect;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(padL, yk); ctx.lineTo(w - padR, yk); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COL.detect;
      ctx.font = "600 11px " + COL.mono;
      const kl = "k = " + k.toFixed(1);
      ctx.fillText(kl, w - padR - ctx.measureText(kl).width, yk - 5);

      // x axis ticks
      ctx.fillStyle = COL.ink3;
      ctx.font = "11px " + COL.mono;
      const ax = "sentence pair i";
      const axW = ctx.measureText(ax).width;
      ctx.fillText(ax, w - padR - axW, h - 12);
      for (let i = 0; i < m; i += 10) {
        const lbl = String(i + 1);
        const lw = ctx.measureText(lbl).width;
        const lx = X(i) - lw / 2;
        if (lx + lw > w - padR - axW - 10) continue;
        ctx.fillText(lbl, lx, h - 12);
      }
    }

    slider.addEventListener("input", render);
    btnNew.addEventListener("click", () => {
      seed = 1000 + Math.floor(Math.random() * 90000);
      doc = S.synthDocument(seed);
      render();
    });
    btnReset.addEventListener("click", () => {
      seed = DEFAULT_SEED;
      doc = S.synthDocument(seed);
      slider.value = "2.5";
      render();
    });
    window.addEventListener("resize", render);
    render();
  })();

  /* ---------------- figure zoom ---------------- */
  (function zoom() {
    let box = null, lastFocus = null;
    function close() {
      if (!box) return;
      box.remove(); box = null;
      document.removeEventListener("keydown", onKey);
      if (lastFocus) lastFocus.focus();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.querySelectorAll(".shot").forEach((frame) => {
      frame.addEventListener("click", () => {
        const img = frame.querySelector("img");
        lastFocus = frame;
        box = document.createElement("div");
        box.className = "lightbox";
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-modal", "true");
        box.setAttribute("aria-label", img.alt);
        const big = document.createElement("img");
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        const btn = document.createElement("button");
        btn.className = "btn ghost";
        btn.type = "button";
        btn.textContent = "Close";
        box.append(big, btn);
        box.addEventListener("click", close);
        document.body.appendChild(box);
        document.addEventListener("keydown", onKey);
        btn.focus();
      });
    });
  })();

  /* ---------------- tab groups ---------------- */
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    function select(tab) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise().catch(() => {});
    }
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
          select(n); n.focus(); e.preventDefault();
        }
      });
    });
  });

  /* ---------------- bars grow when scrolled to ---------------- */
  (function grow() {
    const els = document.querySelectorAll("[data-grow]");
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("grow"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px 80px 0px" });
    els.forEach((el) => io.observe(el));
  })();

  /* ---------------- copy BibTeX ---------------- */
  (function copyBib() {
    const btn = document.getElementById("copy-bib");
    const pre = document.getElementById("bibtex");
    if (!btn || !pre) return;
    function selectText() {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
    }
    btn.addEventListener("click", () => {
      const text = pre.textContent.trim();
      const done = () => { btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy"), 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => { selectText(); btn.textContent = "Press Ctrl+C"; });
      } else { selectText(); btn.textContent = "Press Ctrl+C"; }
    });
  })();

})();
