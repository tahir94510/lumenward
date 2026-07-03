(() => {
  "use strict";
  const e = document.getElementById("game"),
    t = e.getContext("2d", { alpha: !1, desynchronized: !0 }),
    r = 2 * Math.PI,
    a = "last_light_best",
    n = (e, t, r) => Math.max(t, Math.min(r, e)),
    o = (e, t, r) => e + (t - e) * r,
    s = (e) => e * e * (3 - 2 * e),
    i = (e, t, r, a) => {
      const n = e - r,
        o = t - a;
      return n * n + o * o;
    };
  class l {
    constructor(e = 2654435769) {
      this.seed = e >>> 0;
    }
    next() {
      return ((this.seed = (1664525 * this.seed + 1013904223) >>> 0), this.seed / 4294967296);
    }
    range(e, t) {
      return e + (t - e) * this.next();
    }
    pick(e) {
      return e[Math.floor(this.next() * e.length)];
    }
  }
  const d = new (class {
    constructor() {
      this.enabled = true;
      this.volume = 0.85;
      this.ctx = null;
      this.master = null;
      this.comp = null;
      this.music = null;
      this.noSfx = false;
      this.voices = 0;
      this.maxVoices = 24;
      this.stepAt = 0;
      this.step = 0;
      this.musicGain = 0.072;
      this.musicPattern = [0, 7, 12, 7, 3, 10, 15, 10, -2, 5, 12, 5, 0, 7, 10, 7];
      this.menuPattern = [0, 5, 7, 12, 7, 5, 3, 0, -2, 3, 5, 10, 5, 3, 0, -2];
      this.arpPattern = [0, 4, 7, 12, 7, 4];
      this.bassPattern = [0, 0, -5, -5, -7, -7, -5, -5];
    }
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        this.enabled = false;
        return;
      }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume * 0.9 : 1e-4;
      // Gentle glue compression so stacked SFX never clip or get harsh.
      this.comp = this.ctx.createDynamicsCompressor();
      try {
        this.comp.threshold.value = -14;
        this.comp.knee.value = 26;
        this.comp.ratio.value = 3.2;
        this.comp.attack.value = 0.004;
        this.comp.release.value = 0.18;
      } catch (e) {}
      this.master.connect(this.comp);
      this.comp.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.gain.value = this.musicGain;
      this.music.connect(this.master);
    }
    resume() {
      this.init();
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    }
    _persist() {
      try {
        if (window.LLPlatform && window.LLPlatform.saveSettings)
          window.LLPlatform.saveSettings({
            sound: this.enabled,
            volume: this.volume,
            reducedMotion: !!h.reducedMotion,
            colorblind: !!h.colorblind,
          });
      } catch (e) {}
    }
    toggle() {
      this.resume();
      this.enabled = !this.enabled;
      if (this.master)
        this.master.gain.setTargetAtTime(
          this.enabled ? this.volume * 0.9 : 1e-4,
          this.ctx.currentTime,
          0.025,
        );
      this._persist();
      return this.enabled;
    }
    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master && this.enabled && this.ctx)
        this.master.gain.setTargetAtTime(this.volume * 0.9, this.ctx.currentTime, 0.02);
      this._persist();
    }
    _voice(node) {
      // Track one-shot voices so rapid-fire SFX can't spawn unbounded nodes.
      this.voices++;
      const self = this;
      node.onended = () => {
        self.voices = Math.max(0, self.voices - 1);
      };
    }
    tone(e, t, r = 0.06, a = "square", n = null, o = 0) {
      if (!this.enabled || !this.ctx || this.voices > this.maxVoices) return;
      const s = this.ctx.currentTime,
        i = this.ctx.createOscillator(),
        l = this.ctx.createGain();
      ((i.type = a),
        i.frequency.setValueAtTime(e, s),
        o && i.frequency.exponentialRampToValueAtTime(Math.max(22, e + o), s + t),
        l.gain.setValueAtTime(1e-4, s),
        l.gain.exponentialRampToValueAtTime(r, s + 0.008),
        l.gain.exponentialRampToValueAtTime(1e-4, s + t),
        i.connect(l),
        l.connect(n || this.master),
        this._voice(i),
        i.start(s),
        i.stop(s + t + 0.03));
    }
    noise(e, t = 0.07, r = 900, a = null) {
      if (!this.enabled || !this.ctx || this.voices > this.maxVoices) return;
      const n = this.ctx.currentTime,
        o = Math.max(1, Math.floor(this.ctx.sampleRate * e)),
        s = this.ctx.createBuffer(1, o, this.ctx.sampleRate),
        c = s.getChannelData(0);
      for (let k = 0; k < o; k++) c[k] = (2 * Math.random() - 1) * (1 - k / o);
      const l = this.ctx.createBufferSource(),
        f = this.ctx.createBiquadFilter(),
        g = this.ctx.createGain();
      ((l.buffer = s),
        (f.type = "bandpass"),
        (f.frequency.value = r),
        (f.Q.value = 0.85),
        g.gain.setValueAtTime(t, n),
        g.gain.exponentialRampToValueAtTime(1e-4, n + e),
        l.connect(f),
        f.connect(g),
        g.connect(a || this.master),
        this._voice(l),
        l.start(n),
        l.stop(n + e + 0.02));
    }
    tick(e, t) {
      if (!this.enabled || !this.ctx) return;
      this.stepAt -= e;
      if (this.stepAt > 0) return;
      const playing = "playing" === t,
        menu = "menu" === t;
      // Energy follows the real difficulty curve, so the music intensifies as
      // the run heats up (adaptive/vertical layering).
      const energy = playing
        ? Math.max(0, Math.min(1, (h.elapsed || 0) / 66 + (h.score || 0) / 180))
        : 0;
      this.stepAt = playing ? 0.168 - 0.03 * energy : menu ? 0.255 : 0.23;
      if (this.music)
        this.music.gain.setTargetAtTime(
          playing ? this.musicGain * (0.85 + 0.85 * energy) : menu ? this.musicGain * 0.8 : this.musicGain,
          this.ctx.currentTime,
          0.25,
        );
      const pat = menu ? this.menuPattern : this.musicPattern,
        note = pat[this.step % pat.length],
        bass = this.bassPattern[Math.floor(this.step / 2) % this.bassPattern.length],
        root = (menu ? 123.47 : 146.83) * Math.pow(2, note / 12),
        bassHz = 73.415 * Math.pow(2, bass / 12);
      this.tone(root, menu ? 0.105 : 0.08, playing ? 0.034 : menu ? 0.019 : 0.022, "triangle", this.music, 0);
      this.step % 2 == 1 &&
        this.tone(1.5 * root, 0.055, playing ? 0.01 : menu ? 0.004 : 0.006, "sine", this.music, 0);
      this.step % 4 == 0 &&
        this.tone(bassHz, menu ? 0.2 : 0.15, playing ? 0.03 : menu ? 0.014 : 0.018, "sine", this.music, -8);
      // Arpeggio layer fades in as the run gains energy.
      if (playing && energy > 0.18) {
        const arp = this.arpPattern[this.step % this.arpPattern.length];
        this.tone(2 * root * Math.pow(2, arp / 12), 0.05, 0.012 * (energy - 0.1), "square", this.music, 40);
      }
      // Soft hi-hat shimmer at higher energy for extra drive.
      if (playing && energy > 0.42 && this.step % 2 == 0)
        this.noise(0.03, 0.01 * (energy - 0.3), 5200, this.music);
      this.step++;
    }
    hit(e) {
      this.noSfx || this.tone(e ? 330 : 610, 0.055, 0.045, "square", null, e ? -18 : 120);
    }
    crack() {
      this.noSfx ||
        (this.noise(0.07, 0.035, 720), this.tone(150, 0.075, 0.026, "sawtooth", null, -40));
    }
    pop(e) {
      if (this.noSfx) return;
      (this.tone(520 + 42 * Math.min(e, 9), 0.08, 0.055, "triangle", null, 180),
        this.noise(0.075, 0.035, 1400));
      // Extra sparkle as combos climb — the honest dopamine ladder.
      if (e >= 4) this.tone(880 + 60 * Math.min(e, 12), 0.06, 0.02, "sine", null, 220);
    }
    clutch() {
      if (this.noSfx) return;
      // A bright rising triad — the "whew" of a skill brink-save.
      (this.tone(660, 0.06, 0.04, "triangle", null, 120),
        this.tone(990, 0.07, 0.03, "triangle", null, 160),
        this.tone(1320, 0.08, 0.024, "sine", null, 200));
    }
    heal() {
      this.noSfx ||
        (this.tone(720, 0.11, 0.052, "sine", null, 260),
        this.tone(1040, 0.12, 0.028, "triangle", null, 180));
    }
    damage() {
      this.noSfx ||
        (this.noise(0.16, 0.08, 460), this.tone(120, 0.18, 0.055, "sawtooth", null, -55));
    }
    final() {
      this.noSfx ||
        (this.noise(0.55, 0.18, 620),
        this.tone(78, 0.62, 0.11, "sawtooth", null, -38),
        this.tone(220, 0.26, 0.055, "triangle", null, -95));
    }
    reform() {
      this.noSfx ||
        (this.tone(246, 0.14, 0.022, "triangle", null, 110),
        this.tone(369, 0.18, 0.018, "sine", null, 160),
        this.tone(554, 0.24, 0.014, "triangle", null, 220));
    }
    button() {
      this.noSfx || this.tone(480, 0.055, 0.035, "square", null, 80);
    }
  })(),
    h = {
      mode: "menu",
      time: 0,
      last: performance.now(),
      w: 0,
      h: 0,
      cssW: 0,
      cssH: 0,
      dpr: 1,
      quality: 1,
      centerX: 0,
      centerY: 0,
      starR: 64,
      starScale: 1,
      targetStarScale: 1,
      bg: [],
      dust: [],
      buttons: [],
      pointer: {
        x: -9999,
        y: -9999,
        px: -9999,
        py: -9999,
        vx: 0,
        vy: 0,
        speed: 0,
        movedAt: -999,
        down: !1,
        inside: !1,
        type: "mouse",
        lastHit: -999,
        lastTarget: null,
      },
      asteroids: [],
      particles: [],
      sparks: [],
      shards: [],
      texts: [],
      seed: 123456,
      rng: new l(123456),
      score: 0,
      best: (function () {
        try {
          if (window.LLPlatform && window.LLPlatform.loadBest) return window.LLPlatform.loadBest();
          return Number(localStorage.getItem(a) || 0) || 0;
        } catch (e) {
          return 0;
        }
      })(),
      combo: 0,
      comboTimer: 0,
      damage: 0,
      elapsed: 0,
      level: 1,
      spawnTimer: 0.48,
      spawnIndex: 0,
      recentLanes: [],
      shake: 0,
      flash: 0,
      gameoverT: 0,
      reassembleT: 0,
      reassembleTarget: null,
      canInteract: !0,
      menuTimer: 0,
      menuAsteroids: [],
      pausedFrom: null,
      overButtonsReady: !1,
      afterglowTimer: 0,
      spawnQueue: [],
      safeTop: 0,
      safeBottom: 0,
      layoutMode: "landscape",
      fpsAvg: 60,
      perfParticles: 1,
      lastResizeStamp: 0,
      runId: 0,
      hitCooldown: 0.048,
      asteroidHitCooldown: 0.078,
      reducedMotion: null,
      colorblind: !1,
      hydrated: !1,
    };
  // Load persisted preferences (sound, volume, reduced motion, colorblind).
  // Falls back to the OS reduced-motion preference when the player hasn't chosen.
  function loadGameSettings() {
    try {
      const st =
        window.LLPlatform && window.LLPlatform.loadSettings ? window.LLPlatform.loadSettings() : {};
      if (typeof st.sound === "boolean") d.enabled = st.sound;
      if (typeof st.volume === "number") d.volume = Math.max(0, Math.min(1, st.volume));
      if (typeof st.reducedMotion === "boolean") h.reducedMotion = st.reducedMotion;
      if (typeof st.colorblind === "boolean") h.colorblind = st.colorblind;
    } catch (e) {}
    try {
      if (h.reducedMotion == null && window.matchMedia)
        h.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    if (h.reducedMotion == null) h.reducedMotion = !1;
  }
  loadGameSettings();
  function c() {
    const a = {
        initialized: h.w > 0 && h.h > 0,
        w: h.w,
        h: h.h,
        cx: h.centerX || 0,
        cy: h.centerY || 0,
        r: h.starR || 64,
      },
      o = window.devicePixelRatio || 1,
      s = window.visualViewport,
      i = Math.max(
        1,
        Math.round(
          (s && s.width) || window.innerWidth || document.documentElement.clientWidth || 1,
        ),
      ),
      d = Math.max(
        1,
        Math.round(
          (s && s.height) || window.innerHeight || document.documentElement.clientHeight || 1,
        ),
      ),
      c = i * d;
    ((h.dpr = n(o, 1, c > 24e5 ? 1.25 : c > 14e5 ? 1.5 : 2)),
      (h.cssW = i),
      (h.cssH = d),
      (h.w = Math.max(1, Math.floor(i * h.dpr))),
      (h.h = Math.max(1, Math.floor(d * h.dpr))),
      (e.width = h.w),
      (e.height = h.h),
      (e.style.width = i + "px"),
      (e.style.height = d + "px"),
      t.setTransform(1, 0, 0, 1, 0, 0));
    const m = Math.min(h.w, h.h),
      g = h.h > 1.08 * h.w,
      u = h.w > 2.1 * h.h;
    ((h.layoutMode = g ? "portrait" : u ? "wide" : "landscape"),
      (h.safeTop = Math.max(12 * h.dpr, Math.round(0 * (window.screenTop || 0)))),
      (h.safeBottom = 14 * h.dpr));
    const b = m * (g ? 0.083 : u ? 0.092 : 0.095),
      x = Math.max(30 * h.dpr, 0.055 * m),
      M = Math.min(88 * h.dpr, m * (g ? 0.108 : 0.115)),
      y = g && h.h < 760 * h.dpr ? 3 : 2,
      w = y * n(0.44 * b, 27 * h.dpr, 47 * h.dpr) + 10 * Math.max(y - 1, 0) * h.dpr + 30 * h.dpr,
      v = n(1.18 * b, 52 * h.dpr, 112 * h.dpr),
      S = Math.max(x, (h.h - v - w) / 3.25);
    h.starR = n(Math.min(b, S), x, M);
    const T = h.safeTop + v + h.starR + 8 * h.dpr,
      R = h.h - w - h.starR - h.safeBottom,
      k = h.h * (g ? 0.455 : u ? 0.515 : 0.505);
    ((h.centerX = 0.5 * h.w),
      (h.centerY = R > T ? n(k, T, R) : 0.5 * h.h),
      (function (e) {
        if (!e || !e.initialized) return;
        const t = e.r > 0 ? h.starR / e.r : 1,
          r = (r) => h.centerX + (r - e.cx) * t,
          a = (r) => h.centerY + (r - e.cy) * t;
        for (const e of [h.asteroids, h.menuAsteroids])
          for (const t of e)
            t &&
              ((t.radius = f(t.hits)),
              (t.baseRadius = t.radius),
              (t.startR = p(t.angle, t.axis || 1, !!t.menu) + h.starR * (t.menu ? 0.2 : 0.36)),
              (t.trail = C(t, 28)),
              P(t, 0));
        for (const o of h.sparks)
          o &&
            ((o.radius = 0.2 * h.starR),
            (o.orbit = n((o.orbit || 2 * e.r) * t, 1.7 * h.starR, 2.7 * h.starR)),
            (o.x = r(o.x)),
            (o.y = a(o.y)));
        for (const e of [h.particles, h.texts, h.shards])
          for (const n of e)
            n &&
              ((n.x = r(n.x)),
              (n.y = a(n.y)),
              "tx" in n && (n.tx = r(n.tx)),
              "ty" in n && (n.ty = a(n.ty)),
              "orbitR" in n && (n.orbitR *= t),
              "r" in n && (n.r *= t),
              "size" in n && (n.size *= t));
      })(a),
      (function () {
        ((h.bg.length = 0), (h.dust.length = 0));
        const e = Math.floor((h.w * h.h) / (9500 * h.dpr * h.dpr)),
          t = Math.floor((h.w * h.h) / (21e3 * h.dpr * h.dpr)),
          a = new l(4566793 + Math.floor(h.w + h.h));
        for (let t = 0; t < e; t++)
          h.bg.push({
            x: a.range(0, h.w),
            y: a.range(0, h.h),
            s: a.range(0.45, 1.8) * h.dpr,
            a: a.range(0.24, 0.9),
            z: a.range(0.15, 1),
            tw: a.range(0, r),
          });
        for (let e = 0; e < t; e++)
          h.dust.push({
            x: a.range(0, h.w),
            y: a.range(0, h.h),
            vx: a.range(-0.012, 0.012) * h.dpr,
            vy: a.range(0.006, 0.026) * h.dpr,
            s: a.range(0.7, 1.8) * h.dpr,
            a: a.range(0.04, 0.16),
          });
      })(),
      (h.lastResizeStamp = h.time));
  }
  function f(e) {
    return h.starR * (1 === e ? 0.23 : 2 === e ? 0.31 : 0.39);
  }
  function p(e, t = 1, r = !1) {
    const a = h.starR * (r ? 0.4 : 0.65) + 22 * h.dpr,
      n = Math.cos(e) * t,
      o = Math.sin(e) / t,
      s = [];
    (n > 1e-4 ? s.push((h.w + a - h.centerX) / n) : n < -1e-4 && s.push((-a - h.centerX) / n),
      o > 1e-4 ? s.push((h.h + a - h.centerY) / o) : o < -1e-4 && s.push((-a - h.centerY) / o));
    const i = s.filter(Number.isFinite).filter((e) => e > 0),
      l = 0.72 * Math.max(h.w, h.h);
    return i.length ? Math.min(...i) : l;
  }
  function m(e, t = 800) {
    return `${t} ${Math.round(e)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  }
  function g(e, r, a = 850) {
    (t.save(), (t.font = m(r, a)));
    const n = t.measureText(String(e)).width;
    return (t.restore(), n);
  }
  function u(e, r, a, n, o = {}) {
    (t.save(),
      (t.textAlign = o.align || "center"),
      (t.textBaseline = o.base || "middle"),
      (t.font = m(n, o.weight || 850)),
      !1 !== o.shadow &&
        ((t.shadowColor = o.shadowColor || "rgba(255, 202, 99, .55)"),
        (t.shadowBlur = o.shadowBlur || 0.35 * n)),
      o.stroke &&
        ((t.strokeStyle = o.stroke), (t.lineWidth = Math.max(2, 0.12 * n)), t.strokeText(e, r, a)),
      (t.fillStyle = o.color || "#fff0b7"),
      t.fillText(e, r, a),
      t.restore());
  }
  function b(e, r, a, n) {
    let o = a;
    for (t.save(); o > n && ((t.font = m(o, 850)), !(t.measureText(e).width <= r)); ) o *= 0.92;
    return (t.restore(), o);
  }
  function fmtNum(e) {
    const t = Math.max(0, Math.floor(Number(e) || 0));
    if (t < 1e4) return String(t);
    const r = [
      ["T", 1e12],
      ["B", 1e9],
      ["M", 1e6],
      ["K", 1e3],
    ];
    for (const [e, a] of r)
      if (t >= a) {
        const r = t / a,
          n = r >= 100 ? 0 : 1;
        return r.toFixed(n).replace(/\.0$/, "") + e;
      }
    return String(t);
  }
  function x(e, r, a, n, o) {
    ((o = Math.min(o, a / 2, n / 2)),
      t.beginPath(),
      t.moveTo(e + o, r),
      t.arcTo(e + a, r, e + a, r + n, o),
      t.arcTo(e + a, r + n, e, r + n, o),
      t.arcTo(e, r + n, e, r, o),
      t.arcTo(e, r, e + a, r, o),
      t.closePath());
  }
  function M(e, t, r, a, n, o, s, i = "") {
    h.buttons.push({ id: e, label: t, x: r, y: a, w: n, h: o, action: s, sub: i, hover: !1 });
  }
  function y() {
    "playing" === h.mode &&
      (d.button(), (h.mode = "paused"), (h.canInteract = !1), (h.last = performance.now()));
  }
  function w() {
    "paused" === h.mode &&
      ((h.mode = "playing"),
      (h.canInteract = !0),
      (h.last = performance.now()),
      (d.noSfx = !1),
      d.button());
  }
  function v() {
    h.buttons.length = 0;
    const e = h.starR * h.starScale,
      t = d.enabled ? "SOUND ON" : "SOUND OFF",
      r = () => T(),
      a = () =>
        (function () {
          (d.resume(), d.button());
          const e = () => {
            ((h.mode = "menu"),
              (h.canInteract = !1),
              (h.damage = 0),
              (h.asteroids.length = 0),
              (h.spawnQueue.length = 0),
              (h.particles.length = 0),
              (h.menuAsteroids.length = 0),
              (h.sparks.length = 0),
              (h.texts.length = 0),
              (h.menuTimer = 0),
              (d.noSfx = !0));
          };
          "gameover" === h.mode && h.shards.length ? R(e) : e();
        })(),
      o = () => w(),
      s = () => y();
    let i = [];
    if ("menu" === h.mode)
      i = [
        ["begin", "BEGIN", r],
        [
          "sound",
          t,
          () => {
            (d.button(), d.toggle());
          },
        ],
      ];
    else {
      if ("paused" === h.mode) {
        const e = n(0.38 * h.starR, 24 * h.dpr, 36 * h.dpr);
        M("resume", "▶", 18 * h.dpr, 18 * h.dpr, 1.2 * e, 1.2 * e, o, "");
        const r = [
            ["menu", "MENU", a],
            [
              "sound",
              t,
              () => {
                (d.button(), d.toggle());
              },
            ],
          ],
          s = 14 * h.dpr,
          i = n(0.14 * h.starR, 6 * h.dpr, 12 * h.dpr);
        let l = n(0.32 * h.starR, 23 * h.dpr, 36 * h.dpr),
          c = n(1.18 * h.starR, 86 * h.dpr, Math.min(146 * h.dpr, 0.42 * h.w));
        const f = 2 * c + i <= 0.92 * h.w,
          p = f ? 1 : 2,
          m = h.centerY + 1.46 * h.starR,
          g = (h.h - m - s - i * (p - 1)) / p;
        ((l = n(Math.min(l, g), 21 * h.dpr, 36 * h.dpr)),
          f && (c = Math.min(c, (0.92 * h.w - i) / 2)));
        const u = p * l + i * (p - 1),
          b = n(m, h.centerY + h.starR + 8 * h.dpr, h.h - u - s);
        if (f) {
          const e = 2 * c + i,
            t = h.centerX - e / 2;
          r.forEach((e, r) => M(e[0], e[1], t + r * (c + i), b, c, l, e[2], ""));
        } else
          r.forEach((e, t) => M(e[0], e[1], h.centerX - c / 2, b + t * (l + i), c, l, e[2], ""));
        return;
      }
      if ("gameover" === h.mode) {
        if (!h.overButtonsReady) return;
        i = [
          ["retry", "RETRY", r],
          ["menu", "MENU", a],
        ];
      } else if ("playing" === h.mode) {
        const e = n(0.38 * h.starR, 24 * h.dpr, 36 * h.dpr);
        return void M("pause", "Ⅱ", 18 * h.dpr, 18 * h.dpr, 1.2 * e, 1.2 * e, s, "");
      }
    }
    if (!i.length) return;
    const l = 14 * h.dpr,
      c = n(0.15 * e, 6 * h.dpr, 13 * h.dpr),
      f = h.centerY + e + n(0.46 * e, 22 * h.dpr, 44 * h.dpr);
    let p = n(0.44 * e, 27 * h.dpr, 47 * h.dpr),
      m = n(2.16 * e, 108 * h.dpr, Math.min(188 * h.dpr, 0.72 * h.w));
    const g = i.length > 1 && i.length * m + (i.length - 1) * c <= 0.92 * h.w,
      u = g ? 1 : i.length,
      b = (Math.max(20 * h.dpr, h.h - f - l) - c * Math.max(0, u - 1)) / u;
    ((p = n(Math.min(p, b), 23 * h.dpr, 47 * h.dpr)),
      g && (m = Math.min(m, (0.92 * h.w - c * (i.length - 1)) / i.length)));
    const x = u * p + c * Math.max(0, u - 1),
      v = n(f, h.centerY + e + 8 * h.dpr, h.h - x - l);
    if (g) {
      const e = i.length * m + (i.length - 1) * c,
        t = h.centerX - e / 2;
      i.forEach((e, r) => M(e[0], e[1], t + r * (m + c), v, m, p, e[2], ""));
    } else i.forEach((e, t) => M(e[0], e[1], h.centerX - m / 2, v + t * (p + c), m, p, e[2], ""));
  }
  function S() {
    v();
    const e = h.pointer.x,
      r = h.pointer.y;
    for (const a of h.buttons) {
      ((a.hover = e >= a.x && e <= a.x + a.w && r >= a.y && r <= a.y + a.h), t.save());
      const n = a.hover ? 1 : 0;
      x(a.x, a.y, a.w, a.h, Math.min(0.24 * a.h, 14 * h.dpr));
      const o = t.createLinearGradient(a.x, a.y, a.x, a.y + a.h);
      (o.addColorStop(0, n ? "rgba(91, 61, 36, .94)" : "rgba(35, 27, 38, .88)"),
        o.addColorStop(1, n ? "rgba(24, 20, 33, .96)" : "rgba(13, 12, 24, .94)"),
        (t.fillStyle = o),
        t.fill(),
        (t.lineWidth = Math.max(2, 1.5 * h.dpr)),
        (t.strokeStyle = n ? "rgba(255, 226, 142, .95)" : "rgba(255, 214, 132, .52)"),
        t.stroke(),
        (t.globalAlpha = 0.28),
        (t.strokeStyle = "#fff3bf"),
        (t.lineWidth = h.dpr),
        t.beginPath(),
        t.moveTo(a.x + 0.24 * a.h, a.y + 4 * h.dpr),
        t.lineTo(a.x + a.w - 0.24 * a.h, a.y + 4 * h.dpr),
        t.stroke(),
        (t.globalAlpha = 1),
        u(a.label, a.x + a.w / 2, a.y + 0.51 * a.h, 0.42 * a.h, {
          color: "#fff0b7",
          stroke: "rgba(13, 8, 18, .8)",
          shadowBlur: 0.18 * a.h,
        }),
        a.sub &&
          u(a.sub, a.x + a.w / 2, a.y + a.h + 0.38 * a.h, 0.2 * a.h, {
            color: "rgba(255, 223, 166, .72)",
            shadow: !1,
            weight: 700,
          }),
        t.restore());
    }
  }
  function T() {
    (d.resume(), d.button());
    const e = () => {
      ((h.seed = (Date.now() ^ (4294967295 * Math.random())) >>> 0),
        (h.rng = new l(h.seed)),
        h.runId++,
        (h.pointer.lastHit = -999),
        (h.pointer.lastTarget = null),
        (h.asteroids.length = 0),
        (h.spawnQueue.length = 0),
        (h.particles.length = 0),
        (h.sparks.length = 0),
        (h.texts.length = 0),
        (h.score = 0),
        (h.combo = 0),
        (h.comboTimer = 0),
        (h.damage = 0),
        (h.elapsed = 0),
        (h.level = 1),
        (h.spawnTimer = 0.24),
        (h.spawnIndex = 0),
        (h.recentLanes.length = 0),
        (h.flash = 0),
        (h.shake = 0),
        (h.overButtonsReady = !1),
        (h.gameoverT = 0),
        (h.afterglowTimer = 0),
        (h.reassembleT = 0),
        (h.reassembleTarget = null),
        (h.canInteract = !0),
        (h.menuAsteroids.length = 0),
        (h.mode = "playing"),
        (d.noSfx = !1));
    };
    "gameover" === h.mode && h.shards.length ? R(e) : e();
  }
  function R(e) {
    if (
      ((h.mode = "reassemble"),
      (h.reassembleT = 0),
      (h.reassembleTarget = e),
      (h.canInteract = !1),
      (d.noSfx = !1),
      d.reform(),
      (d.noSfx = !0),
      (h.particles.length = 0),
      (h.asteroids.length = 0),
      (h.menuAsteroids.length = 0),
      (h.sparks.length = 0),
      !h.shards.length)
    )
      for (let e = 0; e < 48; e++) {
        const t = (e / 48) * r,
          a = h.starR * h.rng.range(1.2, 3.2);
        h.shards.push({
          x: h.centerX + Math.cos(t) * a,
          y: h.centerY + Math.sin(t) * a,
          r: h.rng.range(2, 7) * h.dpr,
          rot: h.rng.range(0, r),
          vr: h.rng.range(-2, 2),
          a: 1,
          c: h.rng.next() < 0.22 ? "#fff4cf" : "#ffc86b",
        });
      }
    for (let e = 0; e < h.shards.length; e++) {
      const t = h.shards[e],
        a = (e / Math.max(1, h.shards.length)) * r;
      ((t.tx = h.centerX + Math.cos(a) * h.starR * h.rng.range(0.05, 0.62)),
        (t.ty = h.centerY + Math.sin(a) * h.starR * h.rng.range(0.05, 0.62)),
        (t.vx = 0),
        (t.vy = 0),
        (t.a = 1));
    }
  }
  function k(e = !1) {
    const t = e ? 0 : n(h.elapsed / 68 + h.score / 175, 0, 1.72),
      a = (function () {
        const e = Math.max(10, Math.floor(12 + n(h.level, 1, 22) / 2));
        let t = 0,
          a = -999;
        const o = Math.floor(((0.61803398875 * h.spawnIndex) % 1) * e);
        for (let r = 0; r < e; r++) {
          const n = (o + r) % e;
          let s = 0.2 * h.rng.next();
          for (let t = 0; t < h.recentLanes.length; t++) {
            const r = Math.min(Math.abs(n - h.recentLanes[t]), e - Math.abs(n - h.recentLanes[t]));
            s += Math.min(r, 4) * (t === h.recentLanes.length - 1 ? 0.65 : 0.25);
          }
          s > a && ((a = s), (t = n));
        }
        for (h.recentLanes.push(t); h.recentLanes.length > 4; ) h.recentLanes.shift();
        return (t / e) * r + h.rng.range(-0.08, 0.08);
      })(),
      s = h.rng.next(),
      i = n(0.065 + 0.12 * t, 0.065, 0.27),
      l = n(0.3 + 0.115 * t, 0.3, 0.49),
      d = e ? (s < 0.82 ? 1 : 2) : s < i ? 3 : s < i + l ? 2 : 1,
      c = h.rng.range(0.72, 1.28),
      m = p(a, c, e),
      g = 0.58 * Math.min(h.w, h.h) + 1.5 * h.starR,
      u = n(m / Math.max(1, g), 0.94, 1.28),
      b = 3 === d ? 1.16 : 2 === d ? 1.05 : 0.92,
      x = (e ? h.rng.range(6.5, 7.8) : o(4.35, 2.95, n(t / 1.25, 0, 1))) * u * b,
      M =
        (e ? h.rng.range(0.62, 0.92) : o(0.95, 1.38, n(t / 1.2, 0, 1))) +
        (1 === d ? 0.11 : 3 === d ? -0.05 : 0),
      y = h.rng.next() < 0.5 ? -1 : 1,
      w = f(d),
      v = m + h.starR * h.rng.range(e ? 0.08 : 0.14, e ? 0.42 : 0.66),
      S = {
        id: `a${h.time}_${h.spawnIndex++}`,
        menu: e,
        angle: a,
        phase: h.rng.range(0, r),
        dir: y,
        turns: M,
        t: 0,
        duration: x,
        hits: d,
        hitsLeft: d,
        radius: w,
        baseRadius: w,
        startR: v,
        axis: c,
        wobble: h.rng.range(0.04, 0.12),
        rot: h.rng.range(0, r),
        rotSpeed: h.rng.range(-1.7, 1.7),
        lastHit: 0,
        dead: !1,
        resolved: !1,
        missed: !1,
        hitFreeze: 0,
        hitGrace: 0,
        hitPulse: 0,
        x: 0,
        y: 0,
        trail: [],
        ageInDanger: 0,
        hue: 1 === d ? 0 : 2 === d ? 1 : 2,
        autoPopAt: e ? h.rng.range(0.5, 0.72) : 99,
      };
    (P(S, 0), (S.trail = C(S, 28)), (e ? h.menuAsteroids : h.asteroids).push(S));
  }
  function A(e, t) {
    t = n(t, 0, 1);
    const a = e.angle + e.dir * (t * r * e.turns + 0.28 * Math.sin(t * Math.PI)),
      i = s(t),
      l = e.startR,
      d = h.starR * (0.64 + (e.radius / h.starR) * 0.22),
      c = o(l, d, i),
      f = Math.cos(a) * c * e.axis,
      p = (Math.sin(a) * c) / e.axis,
      m = Math.sin(t * r * 1.7 + e.phase) * h.starR * e.wobble,
      g = Math.cos(a + Math.PI / 2) * m,
      u = Math.sin(a + Math.PI / 2) * m;
    return { x: h.centerX + f + g, y: h.centerY + p + u, theta: a, r: c };
  }
  function P(e, t) {
    const r = A(e, e.t / e.duration);
    ((e.x = r.x), (e.y = r.y), (e.rot += e.rotSpeed * t));
  }
  function C(e, t) {
    const r = [];
    for (let a = 0; a < t; a++) {
      const n = a / (t - 1);
      r.push(A(e, n));
    }
    return r;
  }
  function Y(e, t, a, n = "rock", o = 1) {
    const s = Math.floor(320 * h.perfParticles);
    h.particles.length > s && (a = Math.floor(0.45 * a));
    const i =
      "heal" === n
        ? ["#bffff4", "#fff4cf", "#8fefff"]
        : "final" === n
          ? ["#fff4cf", "#ffc86b", "#ff7f75", "#ffffff"]
          : "clutch" === n
            ? ["#fff4cf", "#ffc86b", "#bffff4"]
            : ["#d8d0c0", "#ffc86b", "#7f8495"];
    for (let s = 0; s < a; s++) {
      const a = h.rng.range(0, r),
        s = ((h.rng.range(42, "final" === n ? 520 : "clutch" === n ? 330 : 220) * h.dpr) / 1e3) * o;
      h.particles.push({
        x: e,
        y: t,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: h.rng.range(0.35, "final" === n ? 1.35 : 0.78),
        max: 1,
        r: h.rng.range(1.2, "final" === n ? 6.5 : 4) * h.dpr,
        rot: h.rng.range(0, r),
        vr: h.rng.range(-6, 6),
        color: h.rng.pick(i),
        kind: n,
      });
    }
  }
  function X(e, t, r, a = "#fff0b7", o = 16) {
    const s = o * h.dpr,
      i = String(e),
      l = Math.max(g(i, s, 900) / 2 + 8 * h.dpr, 1.2 * s),
      d = Math.max(h.safeTop + Math.max(52 * h.dpr, 0.58 * h.starR), 14 * h.dpr),
      c = h.h - h.safeBottom - Math.max(24 * h.dpr, 1.25 * s);
    let f = n(t, l, h.w - l),
      p = n(r, d, c);
    if ("playing" === h.mode && h.combo > 1 && h.comboTimer > 0) {
      const e = n(1.18 * h.starR, 70 * h.dpr, 110 * h.dpr),
        t = n(0.35 * h.starR, 22 * h.dpr, 34 * h.dpr),
        r = h.centerX - e / 2,
        a = Math.min(h.centerY + 1.52 * h.starR, h.h - t - 18 * h.dpr);
      f > r - l &&
        f < r + e + l &&
        p > a - 1.2 * s &&
        p < a + t + 1.2 * s &&
        ((p = a - 1.25 * s), p < d && (p = a + t + 1.25 * s));
    }
    for (let e = 0; e < 8; e++) {
      let t = !1;
      for (const e of h.texts)
        if (e && e.life > 0) {
          const r = Math.max(s, e.size || s),
            a = Math.max(l, g(e.text || "", e.size || s, 900) / 2 + 7 * h.dpr);
          if (Math.abs(e.x - f) < l + a && Math.abs(e.y - p) < 0.98 * r) {
            t = !0;
            break;
          }
        }
      if (!t) break;
      p = n(p + (0 == e % 2 ? -1 : 1) * (1.08 + 0.2 * e) * s, d, c);
    }
    h.texts.push({
      text: i,
      x: f,
      y: p,
      color: a,
      life: 0.82,
      max: 0.82,
      vy: -31 * h.dpr,
      size: s,
    });
  }
  function L(e, t = !1) {
    if (!e || e.dead || e.resolved) return !1;
    ((e.dead = !0), (e.resolved = !0), (e.t = Math.min(e.t, Math.max(0, e.duration - 1e-4))));
    const r = e.t / e.duration,
      a = !t && r > 0.82,
      o = e.hits;
    if (!t) {
      (h.comboTimer > 0 ? (h.combo = Math.min(32, h.combo + 1)) : (h.combo = 1),
        (h.comboTimer = n(0.92 - 0.016 * h.level, 0.46, 0.92)));
      const t = o + Math.floor(Math.max(0, h.combo - 1) / 1.55) + (a ? 6 : 0);
      ((h.score += t),
        X(`+${t}`, e.x, e.y - 1.4 * e.radius, a ? "#bffff4" : "#fff0b7", a ? 18 : 14),
        a && X("BRINK", e.x, e.y - 2.25 * e.radius, "#bffff4", 13),
        h.combo >= 4 &&
          h.combo % 4 == 0 &&
          X(`x${h.combo}`, h.centerX, h.centerY + 1.25 * h.starR, "#ffc86b", 14),
        h.combo >= 4 &&
          h.combo % 4 == 0 &&
          ((h.spawnTimer = Math.min(h.spawnTimer, 0.24)),
          X("FLOW", h.centerX, h.centerY - 1.55 * h.starR, "#bffff4", 13),
          (h.flash = Math.max(h.flash, 0.055))),
        d.pop(h.combo),
        a &&
          (d.clutch(),
          Y(e.x, e.y, Math.floor(22 * h.perfParticles), "clutch", 1.55),
          (h.shake = Math.max(h.shake, 0.22))));
    }
    return (
      t
        ? (Y(e.x, e.y, Math.floor((4 * e.hits + 22) * h.perfParticles), "rock", 1.18),
          Y(e.x, e.y, Math.floor((9 + 3 * e.hits) * h.perfParticles), "clutch", 0.62),
          (h.flash = Math.max(h.flash, 0.045)))
        : Y(e.x, e.y, Math.floor((e.hits + 8) * h.perfParticles), "rock", 1),
      !0
    );
  }
  function E(e, t = !1) {
    if (!e || e.dead || e.resolved) return !1;
    const r = h.time;
    return (
      !(!t && r - h.pointer.lastHit < h.hitCooldown) &&
      !(!t && r - e.lastHit < h.asteroidHitCooldown) &&
      ((e.lastHit = r),
      (h.pointer.lastHit = r),
      (h.pointer.lastTarget = e.id),
      e.hitsLeft--,
      (e.hitPulse = 1),
      (e.hitFreeze = Math.max(e.hitFreeze || 0, t ? 0.12 : 0.088)),
      (e.hitGrace = Math.max(e.hitGrace || 0, t ? 0.28 : 0.22)),
      d.hit(e.hitsLeft),
      Y(e.x, e.y, Math.floor(7 * h.perfParticles), "rock", 1.05),
      e.hitsLeft <= 0 ? L(e, e.menu) : (d.crack(), (h.shake = Math.max(h.shake, 0.06)), !0))
    );
  }
  function B(e) {
    for (let t = e.length - 1; t >= 0; t--) {
      const r = e[t];
      (!r || r.dead || r.resolved) && e.splice(t, 1);
    }
  }
  function I() {
    "playing" === h.mode &&
      (h.damage++,
      (h.combo = 0),
      (h.comboTimer = 0),
      (h.shake = h.damage >= 3 ? 1 : 0.45),
      (h.flash = h.damage >= 3 ? 0.82 : 0.32),
      d.damage(),
      Y(
        h.centerX,
        h.centerY,
        Math.floor((h.damage >= 3 ? 65 : 25) * h.perfParticles),
        h.damage >= 3 ? "final" : "clutch",
        h.damage >= 3 ? 1.8 : 0.9,
      ),
      h.damage >= 3
        ? (function () {
            ((h.mode = "gameover"),
              (h.gameoverT = 0),
              (h.canInteract = !1),
              (h.overButtonsReady = !1),
              (h.best = Math.max(h.best, h.score)),
              (function (e) {
                try {
                  localStorage.setItem(a, String(e));
                } catch (_) {}
                try {
                  if (window.LLPlatform && window.LLPlatform.saveBest) window.LLPlatform.saveBest(e);
                } catch (_) {}
                try {
                  if (window.LLPlatform && window.LLPlatform.submitScore)
                    window.LLPlatform.submitScore(h.score);
                } catch (_) {}
              })(h.best),
              (h.asteroids.length = 0),
              (h.spawnQueue.length = 0),
              (h.particles.length = 0),
              (h.sparks.length = 0),
              (h.texts.length = 0),
              (h.shards.length = 0),
              (h.flash = 1),
              (h.shake = 1.25),
              (h.afterglowTimer = 0),
              d.final());
            const e = Math.floor(82 * h.perfParticles);
            for (let t = 0; t < e; t++) {
              const e = h.rng.range(0, r),
                t = h.rng.range(0.18 * h.starR, 0.96 * h.starR),
                a = h.rng.range(0.16, 0.54) * h.dpr,
                n = h.rng.range(2.05 * h.starR, 3.35 * h.starR),
                o = e + h.rng.range(-0.28, 0.28);
              h.shards.push({
                x: h.centerX + Math.cos(e) * t,
                y: h.centerY + Math.sin(e) * t,
                vx: Math.cos(e) * a,
                vy: Math.sin(e) * a,
                tx: h.centerX + Math.cos(e) * h.starR * h.rng.range(0.05, 0.65),
                ty: h.centerY + Math.sin(e) * h.starR * h.rng.range(0.05, 0.65),
                orbitA: o,
                orbitR: 0.72 * n,
                ringBase: n,
                ringAmp: h.rng.range(0.08 * h.starR, 0.22 * h.starR),
                orbitAxis: h.rng.range(0.56, 0.76),
                orbitSpeed: h.rng.range(0.18, 0.42) * (h.rng.next() < 0.5 ? -1 : 1),
                wobble: h.rng.range(0, r),
                driftPhase: h.rng.range(0, r),
                driftSpeed: h.rng.range(0.55, 1.15),
                r: h.rng.range(2, 8.5) * h.dpr,
                rot: h.rng.range(0, r),
                vr: h.rng.range(-0.008, 0.008),
                a: 1,
                c: h.rng.next() < 0.26 ? "#fff4cf" : h.rng.next() < 0.55 ? "#ffc86b" : "#ff8a6f",
              });
            }
            Y(h.centerX, h.centerY, Math.floor(118 * h.perfParticles), "final", 2.35);
          })()
        : ((h.spawnTimer = Math.max(h.spawnTimer, 0.58 + 0.11 * h.damage)),
          h.asteroids.forEach((e) => {
            e &&
              !e.dead &&
              !e.resolved &&
              e.t / e.duration > 0.76 &&
              ((e.hitFreeze = Math.max(e.hitFreeze || 0, 0.12)),
              (e.hitGrace = Math.max(e.hitGrace || 0, 0.2)));
          }),
          z()));
  }
  function z() {
    if (h.sparks.filter((e) => !e.dead).length >= 2) return;
    const e = h.rng.range(0, r);
    h.sparks.push({
      angle: e,
      t: 0,
      life: h.damage >= 2 ? 3.55 : 3.05,
      radius: 0.2 * h.starR,
      orbit: h.starR * h.rng.range(1.76, 2.28),
      dir: h.rng.next() < 0.5 ? -1 : 1,
      x: h.centerX,
      y: h.centerY,
      dead: !1,
      exit: !1,
    });
  }
  function G(e) {
    return !(
      !e ||
      e.dead ||
      h.damage <= 0 ||
      (h.damage--,
      (e.dead = !0),
      (e.collected = !0),
      (e.life = 0),
      (e.alpha = 0),
      d.heal(),
      (h.flash = Math.max(h.flash, 0.25)),
      Y(e.x, e.y, Math.floor(22 * h.perfParticles), "heal", 1.1),
      X("HEAL", h.centerX, h.centerY - 1.35 * h.starR, "#bffff4", 15),
      0)
    );
  }
  function H() {
    const e = h.pointer;
    return "mouse" === e.type ? e.inside : e.down;
  }
  function W(e) {
    if (!e || e.dead || e.resolved) return !1;
    const t = h.pointer,
      r = e.t / e.duration,
      a = 0.7 * h.starR;
    return !(r > 0.985 && i(t.x, t.y, h.centerX, h.centerY) < a * a);
  }
  function F(e) {
    if (!e || e.dead || e.resolved || !H()) return !1;
    h.pointer;
    const t = e.t / e.duration,
      r =
        e.radius * ("mouse" === h.pointer.type ? (t > 0.92 ? 1.14 : 1.17) : t > 0.92 ? 1.31 : 1.34);
    return !!O(e.x, e.y, r) && E(e, !1);
  }
  function O(e, t, r) {
    const a = h.pointer;
    return (
      i(a.x, a.y, e, t) <= r * r ||
      (a.px > -1e3 &&
        h.time - a.movedAt < 0.12 &&
        (function (e, t, r, a, o, s) {
          const l = o - r,
            d = s - a,
            h = l * l + d * d;
          if (h <= 1e-4) return i(e, t, r, a);
          const c = n(((e - r) * l + (t - a) * d) / h, 0, 1);
          return i(e, t, r + l * c, a + d * c);
        })(e, t, a.px, a.py, a.x, a.y) <=
          r * r)
    );
  }
  function D() {
    if ("playing" !== h.mode || !h.canInteract) return;
    const e = h.pointer;
    if (!H()) return;
    for (let e = h.sparks.length - 1; e >= 0; e--) {
      const t = h.sparks[e];
      if (!t || t.dead) {
        h.sparks.splice(e, 1);
        continue;
      }
      const r = t.radius * ("mouse" === h.pointer.type ? 2.55 : 2.9);
      if (O(t.x, t.y, r)) return void (G(t) && h.sparks.splice(e, 1));
    }
    let t = null,
      r = 1 / 0;
    for (let a = h.asteroids.length - 1; a >= 0; a--) {
      const o = h.asteroids[a];
      if (!o || o.dead || o.resolved) {
        h.asteroids.splice(a, 1);
        continue;
      }
      const s = o.radius * ("mouse" === h.pointer.type ? 1.16 : 1.32),
        l = i(e.x, e.y, o.x, o.y),
        d = O(o.x, o.y, s),
        c = 0.4 * n(o.t / o.duration, 0, 1),
        f = l / Math.max(1, s * s) - c,
        p =
          h.time - h.pointer.lastHit >= h.hitCooldown &&
          h.time - o.lastHit >= h.asteroidHitCooldown;
      d && p && f < r && ((r = f), (t = o));
    }
    t && F(t);
  }
  function N() {
    const e = (Math.random() - 0.5) * h.shake * 10 * h.dpr,
      a = (Math.random() - 0.5) * h.shake * 10 * h.dpr;
    (t.save(),
      t.translate(e, a),
      (function () {
        const e = t.createRadialGradient(
          h.centerX,
          h.centerY,
          0.3 * h.starR,
          h.centerX,
          h.centerY,
          0.78 * Math.max(h.w, h.h),
        );
        (e.addColorStop(0, "#181133"),
          e.addColorStop(0.35, "#0c0a20"),
          e.addColorStop(1, "#05050d"),
          (t.fillStyle = e),
          t.fillRect(0, 0, h.w, h.h),
          t.save());
        for (const e of h.bg) {
          const r = ((e.y + h.time * (8 + 22 * e.z) * h.dpr) % (h.h + 12 * h.dpr)) - 6 * h.dpr,
            a = e.a * (0.55 + 0.45 * Math.sin(h.time * (0.6 + e.z) + e.tw));
          ((t.globalAlpha = a),
            (t.fillStyle = e.z > 0.75 ? "#fff4cf" : "#8fb4ff"),
            t.fillRect(Math.round(e.x), Math.round(r), Math.max(1, e.s), Math.max(1, e.s)));
        }
        (t.restore(), t.save());
        for (const e of h.dust) {
          const r = (e.x + h.time * e.vx * 900 + h.w) % h.w,
            a = (e.y + h.time * e.vy * 900 + h.h) % h.h;
          ((t.globalAlpha = e.a),
            (t.fillStyle = "#ffc86b"),
            t.fillRect(Math.round(r), Math.round(a), e.s, e.s));
        }
        t.restore();
      })(),
      (function () {
        (t.save(), t.translate(h.centerX, h.centerY), t.rotate(0.035 * h.time));
        const e = h.starR * (1.85 + 0.02 * Math.sin(1.2 * h.time));
        for (let a = 0; a < 5; a++)
          ((t.globalAlpha = 0.12 - 0.014 * a),
            (t.strokeStyle = a % 2 ? "#8fb4ff" : "#ffc86b"),
            (t.lineWidth = Math.max(1, h.dpr)),
            t.setLineDash([8 * h.dpr + a * h.dpr, 14 * h.dpr]),
            t.beginPath(),
            t.ellipse(0, 0, e * (1 + 0.2 * a), e * (0.62 + 0.06 * a), 0.37 * a, 0, r),
            t.stroke());
        (t.setLineDash([]), t.restore());
      })(),
      (function () {
        const e = "menu" === h.mode ? h.menuAsteroids : h.asteroids;
        for (const t of e) q(t);
        for (const e of h.sparks) e && !e.dead && $(e);
        "gameover" !== h.mode &&
          "reassemble" !== h.mode &&
          (function () {
            const e = h.starR * h.starScale,
              a = h.centerX,
              n = h.centerY,
              o = 0.42 * h.time,
              s = 0.5 + 0.5 * Math.sin(2.1 * h.time);
            t.save();
            const i = t.createRadialGradient(a, n, 0.2 * e, a, n, e * (2.55 + 0.22 * s));
            (i.addColorStop(0, "rgba(255, 242, 179, .88)"),
              i.addColorStop(0.2, "rgba(255, 200, 107, .32)"),
              i.addColorStop(0.58, "rgba(143, 180, 255, .10)"),
              i.addColorStop(1, "rgba(5, 5, 13, 0)"),
              (t.fillStyle = i),
              t.beginPath(),
              t.arc(a, n, 2.65 * e, 0, r),
              t.fill(),
              t.translate(a, n),
              t.rotate(o));
            const l = V(0, 0, e, 0.45 * e, 0);
            (t.beginPath(),
              l.forEach((e, r) => (r ? t.lineTo(e[0], e[1]) : t.moveTo(e[0], e[1]))),
              t.closePath());
            const d = t.createLinearGradient(-e, -e, e, e);
            (d.addColorStop(0, "#fff8d4"),
              d.addColorStop(0.46, "#ffc86b"),
              d.addColorStop(1, "#fff0b7"),
              (t.fillStyle = d),
              t.fill(),
              (t.lineWidth = Math.max(2 * h.dpr, 0.055 * e)),
              (t.strokeStyle = "#fff4cf"),
              t.stroke());
            const c = t.createRadialGradient(0, 0, 0.05 * e, 0, 0, 0.85 * e);
            (c.addColorStop(0, "rgba(255,255,255,.58)"),
              c.addColorStop(0.42, "rgba(255,233,170,.18)"),
              c.addColorStop(1, "rgba(255,233,170,0)"),
              (t.fillStyle = c),
              t.beginPath(),
              t.arc(0, 0, 0.88 * e, 0, r),
              t.fill(),
              t.save(),
              (t.globalAlpha = 0.22),
              (t.strokeStyle = "#4c2a1f"),
              (t.lineWidth = Math.max(1, h.dpr)));
            for (let e = 0; e < 5; e++)
              (t.beginPath(), t.moveTo(0, 0), t.lineTo(l[2 * e][0], l[2 * e][1]), t.stroke());
            (t.restore(),
              h.damage > 0 &&
                (function (e, r, a) {
                  (t.save(), t.translate(0, 0), (t.lineCap = "round"), (t.lineJoin = "round"));
                  const n = [
                      [
                        [
                          [0.02, -0.68],
                          [0.04, -0.42],
                          [0, -0.16],
                          [-0.03, 0.02],
                        ],
                        [
                          [0.03, -0.34],
                          [0.17, -0.28],
                        ],
                        [
                          [0.01, -0.1],
                          [-0.12, -0.02],
                        ],
                      ],
                      [
                        [
                          [-0.08, -0.04],
                          [-0.22, 0.14],
                          [-0.38, 0.3],
                          [-0.5, 0.42],
                        ],
                        [
                          [-0.24, 0.12],
                          [-0.13, 0.24],
                        ],
                        [
                          [-0.36, 0.28],
                          [-0.3, 0.44],
                        ],
                      ],
                      [
                        [
                          [0.08, -0.1],
                          [0.24, 0],
                          [0.4, 0.16],
                          [0.54, 0.28],
                        ],
                        [
                          [0.22, 0.02],
                          [0.18, -0.15],
                        ],
                        [
                          [0.39, 0.16],
                          [0.29, 0.28],
                        ],
                      ],
                      [
                        [
                          [0.03, -0.4],
                          [-0.12, -0.5],
                          [-0.24, -0.62],
                        ],
                        [
                          [-0.08, -0.47],
                          [0.02, -0.59],
                        ],
                      ],
                      [
                        [
                          [-0.05, 0.16],
                          [0.02, 0.32],
                          [0.06, 0.5],
                          [0.02, 0.68],
                        ],
                        [
                          [0.02, 0.35],
                          [0.15, 0.42],
                        ],
                        [
                          [0.05, 0.53],
                          [-0.09, 0.6],
                        ],
                      ],
                    ],
                    o = 1 === h.damage ? 2 : 2 === h.damage ? 4 : 5,
                    s = (e, r, s, i = 0) => {
                      ((t.strokeStyle = e), (t.lineWidth = r), (t.globalAlpha = s));
                      for (let e = 0; e < o; e++) {
                        const r = n[e];
                        for (const e of r) {
                          (t.beginPath(), t.moveTo(e[0][0] * a, e[0][1] * a));
                          for (let r = 1; r < e.length; r++)
                            t.lineTo(e[r][0] * a + i, e[r][1] * a + 0.6 * i);
                          t.stroke();
                        }
                      }
                    };
                  (s("rgba(73, 22, 19, .96)", Math.max(2.3 * h.dpr, 0.055 * a), 1, 0),
                    s(
                      "rgba(255, 239, 210, .22)",
                      Math.max(1 * h.dpr, 0.018 * a),
                      0.82,
                      0.25 * h.dpr,
                    ),
                    t.restore());
                })(0, 0, e),
              t.restore());
          })();
        for (const t of e) Q(t);
        ((function () {
          for (const e of h.particles) {
            const r = n(e.life / (e.max || 1), 0, 1);
            (t.save(),
              (t.globalAlpha = Math.min(1, 1.25 * r)),
              t.translate(e.x, e.y),
              t.rotate(e.rot),
              (t.fillStyle = e.color));
            const a = e.r * (0.7 + 0.3 * r);
            ("rock" === e.kind
              ? t.fillRect(-a, 0.7 * -a, 1.8 * a, 1.4 * a)
              : (t.beginPath(),
                t.moveTo(0, 1.3 * -a),
                t.lineTo(0.65 * a, 0),
                t.lineTo(0, 1.3 * a),
                t.lineTo(0.65 * -a, 0),
                t.closePath(),
                t.fill()),
              t.restore());
          }
        })(),
          ("gameover" === h.mode || "reassemble" === h.mode) &&
            (function () {
              t.save();
              for (const e of h.shards)
                (t.save(),
                  t.translate(e.x, e.y),
                  t.rotate(e.rot),
                  (t.globalAlpha = e.a),
                  (t.fillStyle = e.c),
                  (t.strokeStyle = "rgba(255,255,255,.58)"),
                  (t.lineWidth = Math.max(1, h.dpr)),
                  t.beginPath(),
                  t.moveTo(0, 1.15 * -e.r),
                  t.lineTo(0.72 * e.r, 0),
                  t.lineTo(0, 1 * e.r),
                  t.lineTo(0.68 * -e.r, 0),
                  t.closePath(),
                  t.fill(),
                  t.stroke(),
                  t.restore());
              const e = "gameover" === h.mode ? n(h.gameoverT / 0.9, 0, 1) : 0.2,
                a = t.createRadialGradient(
                  h.centerX,
                  h.centerY,
                  1,
                  h.centerX,
                  h.centerY,
                  h.starR * (2.7 + 1.9 * e),
                );
              (a.addColorStop(0, "rgba(255, 244, 207, .58)"),
                a.addColorStop(0.35, "rgba(255, 127, 117, .18)"),
                a.addColorStop(1, "rgba(255, 127, 117, 0)"),
                (t.fillStyle = a),
                t.beginPath(),
                t.arc(h.centerX, h.centerY, h.starR * (2.7 + 1.9 * e), 0, r),
                t.fill(),
                t.restore());
            })(),
          (function () {
            for (const e of h.texts)
              (n(e.life / e.max, 0, 1),
                u(e.text, e.x, e.y, e.size, {
                  color: e.color,
                  stroke: "rgba(5,5,13,.8)",
                  shadowBlur: 0.6 * e.size,
                  weight: 900,
                }));
          })(),
          (function () {
            if ("paused" === h.mode)
              return (
                (function () {
                  const e = h.starR * h.starScale;
                  (t.save(),
                    (t.globalAlpha = 0.18),
                    (t.fillStyle = "#05050d"),
                    t.fillRect(0, 0, h.w, h.h));
                  const r = t.createRadialGradient(
                    h.centerX,
                    h.centerY,
                    1 * e,
                    h.centerX,
                    h.centerY,
                    0.56 * Math.max(h.w, h.h),
                  );
                  (r.addColorStop(0, "rgba(0,0,0,0)"),
                    r.addColorStop(1, "rgba(0,0,0,.78)"),
                    (t.fillStyle = r),
                    t.fillRect(0, 0, h.w, h.h),
                    (t.globalAlpha = 1));
                  const a = n(0.38 * e, 18 * h.dpr, 38 * h.dpr),
                    o = n(0.13 * e, 8 * h.dpr, 14 * h.dpr),
                    s = n(h.centerY - 1.42 * e, 70 * h.dpr, h.centerY - 0.78 * e);
                  (u("PAUSED", h.centerX, s, a, {
                    color: "#fff0b7",
                    stroke: "rgba(5,5,13,.9)",
                    shadowBlur: 0.42 * a,
                    weight: 950,
                  }),
                    u("FROZEN IN ORBIT", h.centerX, s + 0.74 * a, o, {
                      color: "rgba(255, 216, 141, .76)",
                      stroke: "rgba(5,5,13,.68)",
                      shadowBlur: 0.45 * o,
                      weight: 800,
                    }),
                    t.restore());
                })(),
                J(),
                void S()
              );
            ("playing" === h.mode
              ? J()
              : "menu" === h.mode
                ? (function () {
                    const e = h.starR * h.starScale,
                      r = U("LUMENWARD", e, n(0.66 * e, 34 * h.dpr, 74 * h.dpr), 20 * h.dpr),
                      a = g("LUMENWARD", r.titleSize, 950),
                      o = n(0.18 * r.titleSize, 5 * h.dpr, 13 * h.dpr);
                    (a + 6 * o < 0.92 * h.w &&
                      r.titleSize > 18 * h.dpr &&
                      (K(h.centerX - 0.5 * a - 2 * o, r.titleY, o, 0.92),
                      K(h.centerX + 0.5 * a + 2 * o, r.titleY, o, 0.92)),
                      u("LUMENWARD", h.centerX, r.titleY, r.titleSize, {
                        color: "#fff0b7",
                        stroke: "rgba(5,5,13,.88)",
                        shadowBlur: 0.55 * r.titleSize,
                        weight: 950,
                      }),
                      r.showSubtitle &&
                        u("GUARD THE LAST LIGHT", h.centerX, r.subY, r.subSize, {
                          color: "rgba(255, 216, 141, .82)",
                          stroke: "rgba(5,5,13,.75)",
                          shadowBlur: 0.75 * r.subSize,
                          weight: 800,
                        }));
                    const s = r.bottom + 12 * h.dpr,
                      i = h.centerY - 0.82 * e;
                    !(function (e) {
                      const r = h.starR * h.starScale,
                        a = `BEST ${fmtNum(h.best)}`,
                        o = b(a, 0.5 * h.w, n(0.18 * r, 10 * h.dpr, 17 * h.dpr), 8 * h.dpr),
                        s = n(
                          g(a, o, 900) + 24 * h.dpr,
                          74 * h.dpr,
                          Math.min(0.58 * h.w, 180 * h.dpr),
                        ),
                        i = n(1.85 * o, 20 * h.dpr, 32 * h.dpr);
                      (t.save(),
                        x(h.centerX - s / 2, e - 0.52 * i, s, i, 0.34 * i),
                        (t.fillStyle = "rgba(13, 12, 24, .58)"),
                        t.fill(),
                        (t.strokeStyle = "rgba(255, 200, 107, .42)"),
                        (t.lineWidth = Math.max(1, h.dpr)),
                        t.stroke(),
                        u(a, h.centerX, e, o, {
                          color: "rgba(255, 216, 141, .84)",
                          stroke: "rgba(5,5,13,.72)",
                          shadowBlur: 0.3 * o,
                          weight: 900,
                        }),
                        t.restore());
                    })(s < i ? n(h.centerY - 1.14 * e, s, i) : r.bottom + 8 * h.dpr);
                  })()
                : "gameover" === h.mode
                  ? (function () {
                      const e = h.starR * h.starScale,
                        r = U(
                          "THE LIGHT BROKE",
                          e,
                          n(0.52 * e, 24 * h.dpr, 58 * h.dpr),
                          16 * h.dpr,
                        ),
                        a = n((h.gameoverT - 0.35) / 0.6, 0, 1);
                      (t.save(),
                        (t.globalAlpha = a),
                        u("THE LIGHT BROKE", h.centerX, r.titleY, r.titleSize, {
                          color: "#ffcf91",
                          stroke: "rgba(5,5,13,.92)",
                          shadowBlur: 0.55 * r.titleSize,
                          weight: 950,
                        }),
                        r.showSubtitle &&
                          u(
                            "ONE MORE RUN?",
                            h.centerX,
                            r.subY,
                            Math.max(r.subSize, 0.26 * r.titleSize),
                            {
                              color: "rgba(255, 216, 141, .82)",
                              stroke: "rgba(5,5,13,.75)",
                              shadowBlur: 0.7 * r.subSize,
                              weight: 800,
                            },
                          ),
                        _(),
                        t.restore());
                    })()
                  : "reassemble" === h.mode &&
                    (function () {
                      const e = n(h.reassembleT / 0.82, 0, 1);
                      (t.save(), (t.globalAlpha = 1 - e), _(), t.restore());
                    })(),
              "reassemble" !== h.mode && S());
          })());
      })(),
      t.restore(),
      (function () {
        (t.save(), (t.globalAlpha = 0.055), (t.fillStyle = "#000"));
        const e = Math.max(3, Math.floor(3 * h.dpr));
        for (let r = 0; r < h.h; r += e) t.fillRect(0, r, h.w, 1);
        t.globalAlpha = 0.1;
        const r = t.createRadialGradient(
          h.w / 2,
          h.h / 2,
          0.22 * Math.min(h.w, h.h),
          h.w / 2,
          h.h / 2,
          0.72 * Math.max(h.w, h.h),
        );
        (r.addColorStop(0, "rgba(0,0,0,0)"),
          r.addColorStop(1, "rgba(0,0,0,1)"),
          (t.fillStyle = r),
          t.fillRect(0, 0, h.w, h.h),
          t.restore());
      })(),
      h.flash <= 0 ||
        (t.save(),
        (t.globalAlpha = 0.22 * h.flash),
        (t.fillStyle = "#fff4cf"),
        t.fillRect(0, 0, h.w, h.h),
        t.restore()),
      (function () {
        if (!h.pointer.inside || "mouse" !== h.pointer.type) return;
        const e = h.pointer;
        (t.save(),
          t.translate(e.x, e.y),
          (t.globalAlpha = 0.82),
          (t.strokeStyle = "#bffff4"),
          (t.lineWidth = Math.max(1, h.dpr)));
        const a = 8 * h.dpr + 1.5 * Math.sin(9 * h.time) * h.dpr;
        (t.beginPath(),
          t.arc(0, 0, a, 0, r),
          t.stroke(),
          t.beginPath(),
          t.moveTo(1.5 * -a, 0),
          t.lineTo(0.75 * -a, 0),
          t.moveTo(0.75 * a, 0),
          t.lineTo(1.5 * a, 0),
          t.moveTo(0, 1.5 * -a),
          t.lineTo(0, 0.75 * -a),
          t.moveTo(0, 0.75 * a),
          t.lineTo(0, 1.5 * a),
          t.stroke(),
          t.restore());
      })());
  }
  function V(e, t, r, a, n) {
    const o = [];
    for (let s = 0; s < 10; s++) {
      const i = n - Math.PI / 2 + (s * Math.PI) / 5,
        l = s % 2 == 0 ? r : a;
      o.push([e + Math.cos(i) * l, t + Math.sin(i) * l]);
    }
    return o;
  }
  function q(e) {
    if (!e.trail || e.dead || e.resolved) return;
    t.save();
    const r = e.menu ? 0.1 : 0.17;
    ((t.globalAlpha = r),
      (t.strokeStyle = 3 === e.hits ? "#ff7f75" : 2 === e.hits ? "#ffc86b" : "#8fb4ff"),
      (t.lineWidth = Math.max(1, h.dpr)),
      t.setLineDash([3 * h.dpr, 8 * h.dpr]),
      t.beginPath(),
      e.trail.forEach((e, r) => (r ? t.lineTo(e.x, e.y) : t.moveTo(e.x, e.y))),
      t.stroke(),
      t.setLineDash([]),
      t.restore());
  }
  function Q(e) {
    if (e.dead || e.resolved) return;
    const a = e.hitPulse || 0,
      n = e.radius * (1 + 0.045 * a);
    (t.save(),
      t.translate(e.x, e.y),
      t.rotate(e.rot),
      (t.globalAlpha = e.menu ? 0.72 : 1),
      t.beginPath());
    for (let a = 0; a < 13; a++) {
      const o = (a / 13) * r,
        s = n * (0.82 + 0.18 * Math.sin(2.31 * a + e.phase)),
        i = Math.cos(o) * s,
        l = Math.sin(o) * s;
      0 === a ? t.moveTo(i, l) : t.lineTo(i, l);
    }
    t.closePath();
    const o = t.createRadialGradient(0.35 * -n, 0.35 * -n, 0.1 * n, 0, 0, 1.15 * n);
    (1 === e.hits
      ? (o.addColorStop(0, "#e2dccd"), o.addColorStop(1, "#6b6f85"))
      : 2 === e.hits
        ? (o.addColorStop(0, "#f0d29b"), o.addColorStop(1, "#70606a"))
        : (o.addColorStop(0, "#f0a48b"), o.addColorStop(1, "#564057")),
      (t.fillStyle = o),
      t.fill(),
      (t.lineWidth = Math.max(1.5 * h.dpr, 0.08 * n)),
      (t.strokeStyle = "rgba(255, 244, 207, .42)"),
      t.stroke(),
      (t.fillStyle = "rgba(35, 30, 44, .42)"));
    for (let a = 0; a < e.hits + 2; a++) {
      const o = (2.12 * a + e.phase) % r,
        s = n * (0.15 + ((0.37 * a) % 1) * 0.48);
      (t.beginPath(),
        t.ellipse(Math.cos(o) * s, Math.sin(o) * s, 0.11 * n, 0.075 * n, o, 0, r),
        t.fill());
    }
    (!(function (e, r) {
      const a = e.hits - e.hitsLeft;
      if (a <= 0) return;
      const n = [
        [
          [
            [-0.46, -0.58],
            [-0.2, -0.18],
            [-0.1, 0.18],
            [-0.18, 0.5],
          ],
          [
            [-0.22, -0.16],
            [-0.36, -0.02],
          ],
          [
            [-0.12, 0.16],
            [0.02, 0.26],
          ],
        ],
        [
          [
            [0.05, -0.62],
            [0.2, -0.26],
            [0.14, 0.04],
            [0.26, 0.42],
          ],
          [
            [0.16, -0.22],
            [0.34, -0.12],
          ],
          [
            [0.17, 0.06],
            [0, 0.22],
          ],
        ],
        [
          [
            [-0.08, -0.16],
            [0.14, 0.02],
            [0.34, 0.14],
            [0.48, 0.24],
          ],
          [
            [0.12, 0],
            [0.1, -0.18],
          ],
          [
            [0.3, 0.14],
            [0.2, 0.3],
          ],
        ],
      ];
      (t.save(), (t.lineCap = "round"), (t.lineJoin = "round"));
      const o = 3 === e.hits ? "rgba(45, 18, 26, .92)" : "rgba(20, 16, 28, .88)",
        s = 3 === e.hits ? "rgba(255, 229, 214, .18)" : "rgba(255, 244, 207, .15)",
        i = (e, o, s, i = 0) => {
          ((t.strokeStyle = e), (t.lineWidth = o), (t.globalAlpha = s));
          for (let e = 0; e < a; e++) {
            const a = n[e];
            for (const e of a) {
              (t.beginPath(), t.moveTo(e[0][0] * r, e[0][1] * r));
              for (let a = 1; a < e.length; a++) t.lineTo(e[a][0] * r + i, e[a][1] * r + 0.4 * i);
              t.stroke();
            }
          }
        };
      (i(o, Math.max(1.5 * h.dpr, 0.07 * r), 1, 0),
        i(s, Math.max(1 * h.dpr, 0.022 * r), 0.86, 0.16 * h.dpr),
        t.restore());
    })(e, n),
      a > 0 &&
        ((t.globalAlpha = Math.max(t.globalAlpha || 1, 1) * a),
        (t.strokeStyle = "#fff4cf"),
        (t.lineWidth = Math.max(1, 1.8 * h.dpr)),
        t.beginPath(),
        t.arc(0, 0, n * (1.28 + 0.35 * (1 - a)), 0, r),
        t.stroke()),
      !e.menu &&
        e.t / e.duration > 0.72 &&
        ((t.globalAlpha = 0.46 + 0.34 * Math.sin(16 * h.time)),
        (t.strokeStyle = e.t / e.duration > 0.89 ? "#ff7f75" : "#ffc86b"),
        (t.lineWidth = Math.max(1, 1.5 * h.dpr)),
        t.beginPath(),
        t.arc(0, 0, n * (1.32 + 0.12 * Math.sin(8 * h.time)), 0, r),
        t.stroke()),
      t.restore());
  }
  function $(e) {
    const a = e.alpha || 1;
    (t.save(), t.translate(e.x, e.y), t.rotate(2.4 * h.time), (t.globalAlpha = a));
    const n = e.radius * (0.95 + 0.18 * Math.sin(8 * h.time)),
      o = t.createRadialGradient(0, 0, 1, 0, 0, 3.2 * n);
    (o.addColorStop(0, "rgba(191, 255, 244, .94)"),
      o.addColorStop(0.5, "rgba(143, 180, 255, .20)"),
      o.addColorStop(1, "rgba(143, 180, 255, 0)"),
      (t.fillStyle = o),
      t.beginPath(),
      t.arc(0, 0, 3.65 * n, 0, r),
      t.fill(),
      (t.strokeStyle = "#bffff4"),
      (t.lineWidth = Math.max(1.5 * h.dpr, 0.14 * n)),
      t.beginPath(),
      t.moveTo(-n, 0),
      t.lineTo(n, 0),
      t.moveTo(0, -n),
      t.lineTo(0, n),
      t.stroke(),
      (t.globalAlpha = 0.55 * a),
      t.beginPath(),
      t.moveTo(0.55 * -n, 0.55 * -n),
      t.lineTo(0.55 * n, 0.55 * n),
      t.moveTo(0.55 * n, 0.55 * -n),
      t.lineTo(0.55 * -n, 0.55 * n),
      t.stroke(),
      t.restore());
  }
  function U(e, t, r, a) {
    const o = Math.max(10 * h.dpr, h.safeTop || 0),
      s = h.centerY - t - Math.max(12 * h.dpr, 0.2 * t),
      i = Math.max(0, s - o);
    let l = b(e, 0.88 * h.w, r, a),
      d = n(0.225 * l, 8 * h.dpr, 16 * h.dpr),
      c = n(0.105 * l, 3 * h.dpr, 9 * h.dpr),
      f = i >= 0.88 * (l + c + d) && i > 1.65 * a,
      p = l + (f ? c + d : 0);
    if (i < p) {
      const e = n(i / Math.max(p, 1), 0.38, 1);
      ((l = Math.max(0.62 * a, l * e)),
        (d = Math.max(0, d * e)),
        (c *= e),
        (f = f && d >= 7 * h.dpr && i >= l + c + d + 2 * h.dpr),
        (p = l + (f ? c + d : 0)));
    }
    f || ((d = 0), (c = 0), (p = l), i < p && (l = Math.max(0.55 * a, 0.8 * i)), (p = l));
    const m = o + Math.max(0, 0.48 * (i - p)),
      g = n(m + 0.52 * l, o + 0.52 * l, s - (f ? d + c + 0.1 * l : 0.52 * l)),
      u = g + 0.55 * l + c + 0.5 * d;
    return {
      titleSize: l,
      subSize: d,
      titleY: g,
      subY: u,
      showSubtitle: f,
      bottom: f ? u + 0.55 * d : g + 0.55 * l,
      headerBottom: s,
    };
  }
  function K(e, r, a, n = 1) {
    (t.save(), (t.globalAlpha = n));
    const o = V(e, r, a, 0.45 * a, 0.55 * h.time);
    (t.beginPath(),
      o.forEach((e, r) => (r ? t.lineTo(e[0], e[1]) : t.moveTo(e[0], e[1]))),
      t.closePath());
    const s = t.createLinearGradient(e - a, r - a, e + a, r + a);
    (s.addColorStop(0, "#fff8d4"),
      s.addColorStop(0.48, "#ffc86b"),
      s.addColorStop(1, "#fff0b7"),
      (t.fillStyle = s),
      t.fill(),
      (t.strokeStyle = "rgba(255,244,207,.82)"),
      (t.lineWidth = Math.max(1, 0.14 * a)),
      t.stroke(),
      t.restore());
  }
  function _() {
    const e = h.starR * h.starScale,
      t = fmtNum(h.score),
      r = Math.min(0.74 * h.w, 2.05 * e),
      a = n(0.185 * e, 10 * h.dpr, 17 * h.dpr),
      o = b(t, r, n(0.52 * e, 26 * h.dpr, 54 * h.dpr), 18 * h.dpr),
      s = n(0.165 * e, 9 * h.dpr, 15 * h.dpr),
      i = n(0.045 * e, 3 * h.dpr, 7 * h.dpr),
      l = n(0.05 * e, 4 * h.dpr, 8 * h.dpr),
      d = a + i + o + l + s,
      c = h.centerY - 0.5 * d + 0.5 * a,
      f = c + 0.5 * a + i + 0.5 * o,
      p = f + 0.5 * o + l + 0.5 * s;
    (u("SCORE", h.centerX, c, a, {
      color: "rgba(255,240,183,.84)",
      stroke: "rgba(5,5,13,.9)",
      shadowBlur: 0.45 * a,
      weight: 900,
    }),
      u(t, h.centerX, f, o, {
        color: "#fff4cf",
        stroke: "rgba(5,5,13,.92)",
        shadowBlur: 0.55 * o,
        weight: 950,
      }),
      u(`BEST ${fmtNum(h.best)}`, h.centerX, p, s, {
        color: "rgba(255,216,141,.76)",
        stroke: "rgba(5,5,13,.7)",
        shadowBlur: 0,
        weight: 800,
      }));
  }
  function J() {
    const e = 16 * h.dpr,
      r = n(0.25 * h.starR, 14 * h.dpr, 21 * h.dpr),
      a = fmtNum(h.score),
      o = g(a, b(a, 0.3 * h.w, 1.12 * r, 0.78 * r), 950),
      s = n(0.44 * r, 7 * h.dpr, 11 * h.dpr),
      i = g("SCORE", s, 800),
      l = n(Math.max(o, i) + 30 * h.dpr, 76 * h.dpr, Math.min(176 * h.dpr, 0.38 * h.w)),
      d = n(0.48 * h.starR, 32 * h.dpr, 44 * h.dpr),
      c = h.w / 2 - l / 2,
      f = e;
    (t.save(),
      x(c, f, l, d, 0.32 * d),
      (t.fillStyle = "rgba(13, 12, 24, .66)"),
      t.fill(),
      (t.strokeStyle = "rgba(255, 200, 107, .46)"),
      (t.lineWidth = Math.max(1, h.dpr)),
      t.stroke(),
      u("SCORE", h.w / 2, f + 0.29 * d, s, {
        color: "rgba(255,216,141,.74)",
        stroke: "rgba(5,5,13,.6)",
        shadow: !1,
        weight: 800,
      }),
      u(a, h.w / 2, f + 0.67 * d, b(a, 0.78 * l, 0.45 * d, 0.29 * d), {
        color: "#fff0b7",
        stroke: "rgba(5,5,13,.82)",
        shadowBlur: 0.2 * d,
        weight: 950,
      }),
      t.restore());
    const p = n(0.66 * r, 10 * h.dpr, 15 * h.dpr),
      m = h.w - e;
    u(`LEVEL ${fmtNum(h.level)}`, m, e + 0.5 * d, p, {
      align: "right",
      color: "rgba(255, 216, 141, .78)",
      stroke: "rgba(5,5,13,.72)",
      shadow: !1,
      weight: 800,
    });
    const M = 3 - n(h.damage, 0, 3),
      y = n(0.205 * h.starR, 9 * h.dpr, 15 * h.dpr),
      w = n(0.36 * y, 3 * h.dpr, 6 * h.dpr),
      v = m - 3 * (y + w) + w,
      S = e + d + 0.42 * y;
    t.save();
    for (let e = 0; e < 3; e++) {
      const r = v + e * (y + w) + 0.5 * y,
        a = e < M;
      ((t.globalAlpha = a ? 0.96 : 0.32),
        t.translate(r, S),
        t.rotate(Math.PI / 4),
        x(-0.42 * y, -0.42 * y, 0.84 * y, 0.84 * y, 0.12 * y),
        (t.fillStyle = a ? "rgba(255, 200, 107, .82)" : "rgba(38, 31, 47, .72)"),
        t.fill(),
        (t.strokeStyle = a ? "rgba(255,244,207,.72)" : "rgba(255, 200, 107, .30)"),
        (t.lineWidth = Math.max(1, h.dpr)),
        t.stroke(),
        t.setTransform(1, 0, 0, 1, 0, 0));
    }
    if ((t.restore(), "playing" === h.mode && h.combo > 1 && h.comboTimer > 0)) {
      const e = n(1.18 * h.starR, 70 * h.dpr, 110 * h.dpr),
        r = n(0.35 * h.starR, 22 * h.dpr, 34 * h.dpr),
        a = h.centerX - e / 2,
        o = Math.min(h.centerY + 1.52 * h.starR, h.h - r - 18 * h.dpr),
        s = n(h.comboTimer / 0.32, 0, 1);
      (t.save(),
        (t.globalAlpha = 0.78 + 0.22 * s),
        x(a, o, e, r, 0.35 * r),
        (t.fillStyle = "rgba(36,25,26,.52)"),
        t.fill(),
        (t.strokeStyle = "rgba(255,200,107,.55)"),
        (t.lineWidth = h.dpr),
        t.stroke(),
        u(`COMBO x${h.combo}`, h.centerX, o + 0.53 * r, 0.38 * r, {
          color: "#ffc86b",
          stroke: "rgba(5,5,13,.72)",
          shadowBlur: 0.3 * r,
          weight: 900,
        }),
        t.restore());
    }
  }
  function Z(t) {
    const a = (function (t) {
        const r = e.getBoundingClientRect();
        return { x: (t.clientX - r.left) * h.dpr, y: (t.clientY - r.top) * h.dpr };
      })(t),
      o = h.pointer.x,
      s = h.pointer.y;
    ((h.pointer.px = o),
      (h.pointer.py = s),
      (h.pointer.x = a.x),
      (h.pointer.y = a.y),
      (h.pointer.vx = a.x - o),
      (h.pointer.vy = a.y - s),
      (h.pointer.speed = Math.hypot(h.pointer.vx, h.pointer.vy)),
      h.pointer.speed > 0.8 * h.dpr &&
        ((h.pointer.movedAt = h.time),
        h.pointer.speed > 5 * h.dpr &&
          (function (e, t, a = 1) {
            if ("playing" !== h.mode || h.particles.length > 240 * h.perfParticles) return;
            const n = Math.max(1, Math.floor(a * h.perfParticles));
            for (let a = 0; a < n; a++) {
              const a = h.rng.range(0, r),
                n = (h.rng.range(8, 54) * h.dpr) / 1e3;
              h.particles.push({
                x: e + h.rng.range(-4, 4) * h.dpr,
                y: t + h.rng.range(-4, 4) * h.dpr,
                vx: Math.cos(a) * n,
                vy: Math.sin(a) * n,
                life: h.rng.range(0.18, 0.34),
                max: 1,
                r: h.rng.range(0.8, 1.8) * h.dpr,
                rot: h.rng.range(0, r),
                vr: h.rng.range(-3, 3),
                color: h.rng.next() < 0.55 ? "#bffff4" : "#ffc86b",
                kind: "dust",
              });
            }
          })(a.x, a.y, n(h.pointer.speed / (42 * h.dpr), 1, 3))),
      (h.pointer.inside = !0),
      (h.pointer.type = t.pointerType || "mouse"));
  }
  function j(e) {
    const t = Math.min(0.033, Math.max(0.001, (e - h.last) / 1e3));
    ((h.last = e),
      (function (e) {
        if ("paused" === h.mode) return void (d.noSfx = !0);
        ((h.time += e),
          (h.fpsAvg = o(h.fpsAvg, 1 / Math.max(e, 0.001), 0.02)),
          h.fpsAvg < 44
            ? (h.perfParticles = Math.max(0.45, h.perfParticles - 0.03 * e))
            : h.fpsAvg > 57 && (h.perfParticles = Math.min(1, h.perfParticles + 0.01 * e)),
          (h.shake = Math.max(0, h.shake - 2.8 * e)),
          (h.flash = Math.max(0, h.flash - 1.65 * e)),
          (h.comboTimer = Math.max(0, h.comboTimer - e)),
          h.comboTimer <= 0 && "playing" === h.mode && (h.combo = 0),
          (d.noSfx = "menu" === h.mode || "reassemble" === h.mode),
          d.tick(e, h.mode),
          (function (e) {
            if ("menu" === h.mode) {
              ((h.menuTimer -= e),
                h.menuTimer <= 0 &&
                  h.menuAsteroids.length < 5 &&
                  (k(!0), (h.menuTimer = "menu" === h.mode ? 0.82 : 1.4)));
              for (let t = h.menuAsteroids.length - 1; t >= 0; t--) {
                const r = h.menuAsteroids[t];
                !r || r.dead || r.resolved
                  ? h.menuAsteroids.splice(t, 1)
                  : ((r.t += e),
                    P(r, e),
                    !r.dead &&
                      !r.resolved &&
                      r.t / r.duration >= r.autoPopAt &&
                      ((r.t = Math.min(r.t, 0.88 * r.duration)), P(r, 0), L(r, !0)),
                    (r.dead || r.resolved || r.t > r.duration) && h.menuAsteroids.splice(t, 1));
              }
            }
          })(e),
          "playing" === h.mode &&
            (function (e) {
              ((h.elapsed += e),
                (h.level = 1 + Math.floor(h.elapsed / 7.2) + Math.floor(h.score / 34)));
              const t = n(h.elapsed / 66 + h.score / 180, 0, 1.75);
              if (((h.spawnTimer -= e), h.spawnTimer <= 0)) {
                B(h.asteroids);
                const e = Math.floor(4 + 3.05 * t),
                  r = h.asteroids.reduce(
                    (e, t) =>
                      e +
                      (!t || t.dead || t.resolved
                        ? 0
                        : (t.hitsLeft || 1) * (0.68 + 0.58 * n(t.t / t.duration, 0, 1))),
                    0,
                  ),
                  a = (3.05 + 4.75 * t) * (1 - 0.052 * h.damage);
                h.asteroids.length < e && r < a && k(!1);
                const s = o(0.64, 0.36, n(t / 1.2, 0, 1)) + 0.035 * h.damage,
                  i = 0.035 * Math.sin(1.55 * h.elapsed);
                ((h.spawnTimer = Math.max(0.27, s + i + h.rng.range(-0.025, 0.05))),
                  t > 0.42 &&
                    r < 0.78 * a &&
                    h.rng.next() < 0.11 + 0.11 * (t - 0.42) &&
                    h.asteroids.length < e &&
                    h.spawnQueue.push({ runId: h.runId, delay: 0.18, limit: e + 1 }));
              }
              for (let t = h.spawnQueue.length - 1; t >= 0; t--) {
                const r = h.spawnQueue[t];
                r && r.runId === h.runId && "playing" === h.mode
                  ? ((r.delay -= e),
                    r.delay <= 0 &&
                      (B(h.asteroids),
                      h.asteroids.length < r.limit && k(!1),
                      h.spawnQueue.splice(t, 1)))
                  : h.spawnQueue.splice(t, 1);
              }
              for (let t = h.asteroids.length - 1; t >= 0; t--) {
                const r = h.asteroids[t];
                if (!r || r.dead || r.resolved) {
                  h.asteroids.splice(t, 1);
                  continue;
                }
                ((r.hitFreeze = Math.max(0, (r.hitFreeze || 0) - e)),
                  (r.hitGrace = Math.max(0, (r.hitGrace || 0) - e)),
                  (r.hitPulse = Math.max(0, (r.hitPulse || 0) - 5.5 * e)));
                const a = r.hitFreeze > 0 ? 0.55 : 1;
                if (((r.t += e * a), P(r, e), r.dead || r.resolved)) h.asteroids.splice(t, 1);
                else if ((F(r), r.dead || r.resolved)) h.asteroids.splice(t, 1);
                else if (r.t >= r.duration) {
                  const e = h.pointer,
                    a = H(),
                    n = 1.42 * r.radius;
                  if (
                    (a && W(r) && i(e.x, e.y, r.x, r.y) <= n * n && E(r, !0), r.dead || r.resolved)
                  ) {
                    h.asteroids.splice(t, 1);
                    continue;
                  }
                  if ((r.hitGrace || 0) > 0 && r.hitsLeft > 0) {
                    ((r.t = r.duration - 1e-4), P(r, 0));
                    continue;
                  }
                  ((r.resolved = !0), (r.dead = !0), h.asteroids.splice(t, 1), I());
                }
              }
              for (let t = h.sparks.length - 1; t >= 0; t--) {
                const r = h.sparks[t];
                if (!r || r.dead || r.collected) {
                  h.sparks.splice(t, 1);
                  continue;
                }
                ((r.t += e),
                  (r.life -= e),
                  h.damage <= 0 && ((r.exit = !0), (r.life = Math.min(r.life, 0))),
                  r.life <= 0 && (r.exit = !0));
                const a = n(-r.life, 0, 1),
                  i = r.exit ? 1 - s(a) : 1,
                  l = r.angle + r.dir * r.t * 1.8,
                  d = r.orbit * (r.exit ? o(1, 1.85, s(a)) : 1);
                ((r.x = h.centerX + Math.cos(l) * d),
                  (r.y = h.centerY + Math.sin(l) * d * 0.62),
                  (r.alpha = i),
                  r.life < -1 && h.sparks.splice(t, 1));
              }
              (D(),
                h.damage > 0 &&
                  0 === h.sparks.filter((e) => e && !e.dead).length &&
                  h.rng.next() < e * (1 === h.damage ? 0.065 : 0.125) &&
                  z());
            })(e),
          "gameover" === h.mode &&
            (function (e) {
              if (
                ((h.gameoverT += e),
                h.gameoverT > 0.95 && (h.overButtonsReady = !0),
                (h.afterglowTimer -= e),
                h.afterglowTimer <= 0 && h.shards.length)
              ) {
                const e = h.shards[Math.floor(h.rng.next() * h.shards.length)];
                (Y(e.x, e.y, Math.floor(2 + 5 * h.perfParticles), "final", 0.34),
                  (h.afterglowTimer = h.rng.range(0.07, 0.145)));
              }
              const t = s(n(h.gameoverT / 0.42, 0, 1)),
                r = s(n((h.gameoverT - 0.22) / 1.08, 0, 1)),
                a = 1.9 * h.starR,
                i = 3.7 * h.starR;
              for (const s of h.shards) {
                if (t < 0.98) {
                  const t = Math.pow(0.982, 60 * e);
                  ((s.vx *= t),
                    (s.vy *= t),
                    (s.x += s.vx * e * 1e3 * (1 - 0.26 * r)),
                    (s.y += s.vy * e * 1e3 * (1 - 0.26 * r)));
                }
                s.orbitA = (s.orbitA || 0) + (s.orbitSpeed || 0.25) * e;
                const l =
                    Math.sin(h.time * (s.driftSpeed || 0.9) + (s.driftPhase || 0)) *
                    (s.ringAmp || 0.12 * h.starR),
                  d = Math.sin(0.65 * h.time + (s.wobble || 0)) * h.starR * 0.08,
                  c = n((s.ringBase || a) + l + d, a, i);
                s.orbitR = o(s.orbitR || c, c, 0.05 + 0.07 * r);
                const f = h.centerX + Math.cos(s.orbitA) * s.orbitR,
                  p = h.centerY + Math.sin(s.orbitA) * s.orbitR * (s.orbitAxis || 0.66),
                  m = 0.012 + 0.05 * r;
                ((s.x = o(s.x, f, m)),
                  (s.y = o(s.y, p, m)),
                  (s.rot += s.vr * e * 1e3 + (s.orbitSpeed || 0.2) * e * 1.2),
                  (s.a = 0.6 + 0.24 * Math.sin(1.8 * h.time + (s.wobble || 0))));
              }
            })(e),
          "reassemble" === h.mode &&
            (function (e) {
              h.reassembleT += e;
              const t = s(n(h.reassembleT / 0.82, 0, 1));
              for (const r of h.shards) {
                const a = 0.1 + 0.24 * t;
                ((r.x = o(r.x, r.tx, a)),
                  (r.y = o(r.y, r.ty, a)),
                  (r.a = o(r.a, 0.98, 0.1)),
                  (r.rot += r.vr * e * 80));
              }
              if (t >= 1) {
                ((h.shards.length = 0), (h.particles.length = 0));
                const e = h.reassembleTarget;
                ((h.reassembleTarget = null), e && e());
              }
            })(e),
          (function (e) {
            for (let t = h.particles.length - 1; t >= 0; t--) {
              const r = h.particles[t];
              ((r.x += r.vx * e * 1e3),
                (r.y += r.vy * e * 1e3),
                (r.vx *= Math.pow(0.985, 60 * e)),
                (r.vy *= Math.pow(0.985, 60 * e)),
                (r.vy += ("rock" === r.kind ? 8e-5 : 2e-5) * e * 1e3),
                (r.rot += r.vr * e),
                (r.life -= e),
                r.life <= 0 && h.particles.splice(t, 1));
            }
          })(e),
          (function (e) {
            for (let t = h.texts.length - 1; t >= 0; t--) {
              const r = h.texts[t];
              ((r.y += r.vy * e), (r.life -= e), r.life <= 0 && h.texts.splice(t, 1));
            }
          })(e));
        const t =
          "gameover" === h.mode
            ? (function () {
                const e = fmtNum("menu" === h.mode ? h.best : h.score).length,
                  t = "portrait" === h.layoutMode && h.cssH < 560 ? 0.025 : 0.045;
                return n(1 + Math.max(0, e - 3) * t, 1, "portrait" === h.layoutMode ? 1.18 : 1.24);
              })()
            : 1;
        ((h.targetStarScale = t),
          (h.starScale = o(h.starScale, h.targetStarScale, 1 - Math.pow(0.001, e))));
      })(t),
      N(),
      requestAnimationFrame(j));
  }
  (e.addEventListener(
    "pointerdown",
    (t) => {
      (t.preventDefault(), d.resume(), Z(t));
      try {
        e.setPointerCapture(t.pointerId);
      } catch (e) {}
      h.pointer.down = !0;
      const r = { x: h.pointer.x, y: h.pointer.y },
        a =
          ((n = r.x),
          (o = r.y),
          v(),
          h.buttons.find((e) => n >= e.x && n <= e.x + e.w && o >= e.y && o <= e.y + e.h));
      var n, o;
      a ? a.action() : D();
    },
    { passive: !1 },
  ),
    e.addEventListener("contextmenu", (e) => e.preventDefault()),
    e.addEventListener(
      "pointermove",
      (e) => {
        (Z(e), D());
      },
      { passive: !0 },
    ),
    e.addEventListener(
      "pointerup",
      (t) => {
        (Z(t), (h.pointer.down = !1));
        try {
          e.releasePointerCapture(t.pointerId);
        } catch (e) {}
      },
      { passive: !0 },
    ),
    e.addEventListener(
      "pointercancel",
      (t) => {
        ((h.pointer.down = !1), (h.pointer.inside = !1));
        try {
          e.releasePointerCapture(t.pointerId);
        } catch (e) {}
      },
      { passive: !0 },
    ),
    e.addEventListener(
      "pointerleave",
      (e) => {
        ((h.pointer.inside = !1), "mouse" === h.pointer.type && (h.pointer.down = !1));
      },
      { passive: !0 },
    ),
    window.addEventListener("resize", c),
    window.addEventListener("orientationchange", () => setTimeout(c, 80)),
    window.visualViewport &&
      window.visualViewport.addEventListener("resize", () => setTimeout(c, 40)),
    document.addEventListener &&
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          c();
          try {
            d.resume();
          } catch (_) {}
        }
      }),
    window.addEventListener("keydown", (e) => {
      ("Space" === e.code &&
        (e.preventDefault(),
        "menu" === h.mode || "gameover" === h.mode
          ? T()
          : "playing" === h.mode
            ? y()
            : "paused" === h.mode && w()),
        "Escape" === e.code && ("playing" === h.mode ? y() : "paused" === h.mode && w()));
    }),
    c(),
    (d.noSfx = !0),
    (function () {
      try {
        if (window.LLPlatform && window.LLPlatform.init) window.LLPlatform.init();
      } catch (_) {}
    })(),
    requestAnimationFrame((e) => {
      ((h.last = e), j(e));
      try {
        if (window.LLPlatform && window.LLPlatform.ready) window.LLPlatform.ready();
      } catch (_) {}
    }));
})();
