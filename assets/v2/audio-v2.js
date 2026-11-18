// AIM.DUELO 2.0 — Modern Multi-Layered Tactical Audio Engine & Spatial Foley
(() => {
  'use strict';

  const SAMPLE_PATHS = {
    awpShot: 'assets/audio/awp-shot.mp3',
    awpScope: 'assets/audio/awp-scope.mp3',
    hsHelm1: 'assets/audio/headshot-helmet-1.mp3',
    hsHelm2: 'assets/audio/headshot-helmet-2.mp3',
    hsNoHelm1: 'assets/audio/headshot-no-helmet-1.mp3',
    hsNoHelm2: 'assets/audio/headshot-no-helmet-2.mp3',
  };

  function makeSaturationCurve(amount = 18) {
    const n = 512, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function buildRoomImpulse(ctx, dur = 0.55, decay = 3.2) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Early courtyard reflections + smooth diffuse tail
        const early = (i === Math.floor(ctx.sampleRate * (0.018 + ch * 0.004)) || i === Math.floor(ctx.sampleRate * (0.042 + ch * 0.007))) ? 0.45 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.45) + early * (Math.random() * 2 - 1);
      }
    }
    return buf;
  }

  function enhance(AU, getVolume) {
    if (!AU || AU._v2) return;
    AU._v2 = true;

    const origInit = AU.init.bind(AU);
    const origShot = AU.shot.bind(AU);
    const origHit = AU.hit.bind(AU);
    const origStep = AU.step.bind(AU);
    const origLand = AU.land.bind(AU);
    const origScope = AU.scope.bind(AU);
    const origKill = AU.kill.bind(AU);
    const origRoundEnd = AU.roundEnd.bind(AU);
    const origFreezeTick = AU.freezeTick.bind(AU);

    const samples = {};
    let samplesStarted = false;
    let shaper = null, comp = null, reverb = null, reverbGain = null, dryBus = null;

    function loadRealSamples(ctx) {
      if (samplesStarted || typeof fetch !== 'function' || typeof location === 'undefined' || location.protocol === 'file:') return;
      samplesStarted = true;
      for (const [key, url] of Object.entries(SAMPLE_PATHS)) {
        fetch(url).then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab ? ctx.decodeAudioData(ab) : null)
          .then(buf => { if (buf) samples[key] = buf; }).catch(() => {});
      }
    }

    function setupGraph() {
      const c = AU.ctx;
      if (!c || comp) return;
      try {
        comp = c.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.knee.value = 14;
        comp.ratio.value = 4.5;
        comp.attack.value = 0.002;
        comp.release.value = 0.14;

        dryBus = c.createGain();
        dryBus.gain.value = 1.0;

        reverb = c.createConvolver();
        reverb.buffer = buildRoomImpulse(c, 0.52, 3.4);
        reverbGain = c.createGain();
        reverbGain.gain.value = 0.22;

        shaper = c.createWaveShaper();
        shaper.curve = makeSaturationCurve(22);
        shaper.oversample = '2x';

        // Re-route AU.m -> comp -> destination
        try { AU.m.disconnect(); } catch (e) {}
        AU.m.connect(dryBus);
        dryBus.connect(comp);
        AU.m.connect(reverb);
        reverb.connect(reverbGain);
        reverbGain.connect(comp);
        comp.connect(c.destination);

        // Pink-ish / shaped impulse noise buffer for natural acoustics
        const len = c.sampleRate * 2;
        const b = c.createBuffer(1, len, c.sampleRate);
        const d = b.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + white * 0.0990460;
          b1 = 0.96300 * b1 + white * 0.2965164;
          b2 = 0.57000 * b2 + white * 1.0526913;
          d[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.35) * 0.28));
        }
        AU.pb = b;
        loadRealSamples(c);
      } catch (e) {}
    }

    function playSample(buf, gain, pan, rate = 1, lowpass = 18000) {
      const c = AU.ctx;
      if (!c || !buf || gain < 0.005) return false;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const fl = c.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = lowpass;
      const g = c.createGain();
      g.gain.value = gain;
      src.connect(fl); fl.connect(g); AU.out(g, pan);
      src.start(c.currentTime);
      return true;
    }

    // Layered modern acoustic gunshot: supersonic crack + saturated mid bark + sub-bass thump + mechanical cycling + tail
    function acousticShot({ crackF, crackDur, bodyF, bodyQ, bodyDur, thumpF0, thumpF1, thumpDur, mechDelay, tailDur, gain, pan, distFade = 1, silenced = false }) {
      const c = AU.ctx;
      if (!c || gain < 0.003) return;
      const t = c.currentTime;
      const lpCut = Math.max(800, 14000 * distFade);

      // 1. Supersonic transient crack (white noise + highpass + waveshaper)
      if (!silenced) {
        const s1 = c.createBufferSource(); s1.buffer = AU.nb;
        const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.setValueAtTime(Math.min(lpCut, crackF), t); f1.Q.value = 0.7;
        const g1 = c.createGain();
        g1.gain.setValueAtTime(0.0001, t);
        g1.gain.linearRampToValueAtTime(gain * 0.92, t + 0.0015);
        g1.gain.exponentialRampToValueAtTime(0.0001, t + crackDur);
        s1.connect(f1);
        if (shaper) { f1.connect(shaper); shaper.connect(g1); } else f1.connect(g1);
        AU.out(g1, pan);
        s1.start(t, Math.random() * 0.4); s1.stop(t + crackDur + 0.02);
      }

      // 2. Chamber bark / body (pink-shaped noise)
      const s2 = c.createBufferSource(); s2.buffer = AU.pb || AU.nb;
      const f2 = c.createBiquadFilter(); f2.type = 'lowpass';
      f2.frequency.setValueAtTime(Math.min(lpCut, bodyF * 1.8), t);
      f2.frequency.exponentialRampToValueAtTime(Math.max(180, bodyF * 0.35), t + bodyDur);
      f2.Q.value = bodyQ;
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(gain * (silenced ? 0.42 : 0.85), t + 0.003);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + bodyDur);
      s2.connect(f2); f2.connect(g2); AU.out(g2, pan);
      s2.start(t, Math.random() * 0.6); s2.stop(t + bodyDur + 0.03);

      // 3. Chest thump (exponential pitch drop)
      const osc = c.createOscillator(); osc.type = 'triangle';
      osc.frequency.setValueAtTime(thumpF0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(28, thumpF1), t + thumpDur);
      const go = c.createGain();
      go.gain.setValueAtTime(0.0001, t);
      go.gain.linearRampToValueAtTime(gain * (silenced ? 0.28 : 0.62), t + 0.003);
      go.gain.exponentialRampToValueAtTime(0.0001, t + thumpDur);
      osc.connect(go); AU.out(go, pan);
      osc.start(t); osc.stop(t + thumpDur + 0.02);

      // 4. Mechanical bolt/carrier cycle
      if (mechDelay > 0 && distFade > 0.35) {
        const mt = t + mechDelay;
        const sm = c.createBufferSource(); sm.buffer = AU.nb;
        const fm = c.createBiquadFilter(); fm.type = 'bandpass'; fm.frequency.value = silenced ? 2400 : 3200; fm.Q.value = 2.6;
        const gm = c.createGain();
        gm.gain.setValueAtTime(0.0001, mt);
        gm.gain.linearRampToValueAtTime(gain * (silenced ? 0.22 : 0.16), mt + 0.002);
        gm.gain.exponentialRampToValueAtTime(0.0001, mt + 0.028);
        sm.connect(fm); fm.connect(gm); AU.out(gm, pan);
        sm.start(mt, Math.random() * 0.3); sm.stop(mt + 0.035);
      }

      // 5. Outdoor acoustic tail
      if (tailDur > 0.05) {
        const st = c.createBufferSource(); st.buffer = AU.pb || AU.nb;
        const ft = c.createBiquadFilter(); ft.type = 'lowpass'; ft.frequency.value = Math.min(lpCut, silenced ? 750 : 1200);
        const gt = c.createGain();
        gt.gain.setValueAtTime(0.0001, t + 0.015);
        gt.gain.linearRampToValueAtTime(gain * (silenced ? 0.08 : 0.22), t + 0.04);
        gt.gain.exponentialRampToValueAtTime(0.0001, t + tailDur);
        st.connect(ft); ft.connect(gt); AU.out(gt, pan);
        st.start(t + 0.01, Math.random() * 0.5); st.stop(t + tailDur + 0.03);
      }
    }

    const GUN_PROFILES = {
      rifle:  { crackF: 3400, crackDur: 0.022, bodyF: 1700, bodyQ: 0.8, bodyDur: 0.14, thumpF0: 155, thumpF1: 48, thumpDur: 0.09, mechDelay: 0.035, tailDur: 0.28 },
      m4a4:   { crackF: 4100, crackDur: 0.018, bodyF: 2050, bodyQ: 0.9, bodyDur: 0.11, thumpF0: 175, thumpF1: 58, thumpDur: 0.075, mechDelay: 0.028, tailDur: 0.24 },
      m4a1s:  { crackF: 1600, crackDur: 0.014, bodyF: 980,  bodyQ: 1.2, bodyDur: 0.068, thumpF0: 145, thumpF1: 55, thumpDur: 0.055, mechDelay: 0.024, tailDur: 0.11, silenced: true },
      galil:  { crackF: 3600, crackDur: 0.02,  bodyF: 1850, bodyQ: 0.85, bodyDur: 0.12, thumpF0: 162, thumpF1: 52, thumpDur: 0.08, mechDelay: 0.032, tailDur: 0.25 },
      famas:  { crackF: 4300, crackDur: 0.017, bodyF: 2200, bodyQ: 0.95, bodyDur: 0.10, thumpF0: 185, thumpF1: 62, thumpDur: 0.07, mechDelay: 0.026, tailDur: 0.22 },
      ump:    { crackF: 2900, crackDur: 0.016, bodyF: 1500, bodyQ: 0.9, bodyDur: 0.09, thumpF0: 170, thumpF1: 60, thumpDur: 0.065, mechDelay: 0.022, tailDur: 0.18 },
      bucky:  { crackF: 2500, crackDur: 0.032, bodyF: 1100, bodyQ: 0.65, bodyDur: 0.26, thumpF0: 110, thumpF1: 34, thumpDur: 0.19, mechDelay: 0.42, tailDur: 0.42 },
      sniper: { crackF: 3100, crackDur: 0.038, bodyF: 1200, bodyQ: 0.65, bodyDur: 0.36, thumpF0: 92,  thumpF1: 30, thumpDur: 0.28, mechDelay: 0.04, tailDur: 0.58 },
      ssg:    { crackF: 3900, crackDur: 0.026, bodyF: 1650, bodyQ: 0.75, bodyDur: 0.24, thumpF0: 130, thumpF1: 42, thumpDur: 0.16, mechDelay: 0.03, tailDur: 0.40 },
      pistol: { crackF: 3500, crackDur: 0.025, bodyF: 1450, bodyQ: 0.75, bodyDur: 0.22, thumpF0: 120, thumpF1: 38, thumpDur: 0.18, mechDelay: 0.065, tailDur: 0.36 },
      usps:   { crackF: 1750, crackDur: 0.012, bodyF: 1080, bodyQ: 1.3, bodyDur: 0.058, thumpF0: 195, thumpF1: 72, thumpDur: 0.048, mechDelay: 0.022, tailDur: 0.09, silenced: true },
      glock:  { crackF: 3800, crackDur: 0.015, bodyF: 1950, bodyQ: 1.0, bodyDur: 0.075, thumpF0: 215, thumpF1: 75, thumpDur: 0.052, mechDelay: 0.025, tailDur: 0.15 },
    };

    AU.init = function () {
      origInit();
      setupGraph();
      if (typeof getVolume === 'function') AU.vol(getVolume());
    };

    AU.shot = function (w, v = 1, pan = 0, skin = 'padrao') {
      if (!AU.ctx) return;
      setupGraph();
      const distFade = Math.max(0.2, Math.min(1, v));
      if (skin && skin !== 'padrao') {
        if (w === 'pistol') {
          acousticShot({ ...GUN_PROFILES.pistol, gain: 0.65 * v, pan, distFade });
          AU.skinShot(skin, w, v * 0.24, pan);
          return;
        }
        AU.skinShot(skin, w, v, pan);
        return;
      }
      if (w === 'sniper' && samples.awpShot) {
        playSample(samples.awpShot, 0.85 * v, pan, 0.97 + Math.random() * 0.06, Math.max(1200, 16000 * distFade));
        return;
      }
      const prof = GUN_PROFILES[w];
      if (prof) {
        const pitchJit = 0.96 + Math.random() * 0.08;
        acousticShot({
          ...prof,
          crackF: prof.crackF * pitchJit,
          bodyF: prof.bodyF * pitchJit,
          thumpF0: prof.thumpF0 * pitchJit,
          gain: 0.65 * v,
          pan,
          distFade,
        });
        if (w === 'bucky') {
          // Pump rack foley
          AU.noise(0.035, 2200, 2.2, 0.14 * v, pan, 'bandpass', 0.42);
          AU.noise(0.04, 1550, 2.0, 0.16 * v, pan, 'bandpass', 0.55);
        }
        return;
      }
      if (w === 'knife') {
        AU.noise(0.11, 1850, 1.1, 0.18 * v, pan, 'bandpass');
        return;
      }
      origShot(w, v, pan, skin);
    };

    AU.hit = function (head, helmet = false, skin = 'padrao') {
      if (!AU.ctx) return;
      setupGraph();
      if (head) {
        const key = helmet ? (Math.random() < 0.5 ? 'hsHelm1' : 'hsHelm2') : (Math.random() < 0.5 ? 'hsNoHelm1' : 'hsNoHelm2');
        if (samples[key]) {
          playSample(samples[key], 0.72, 0, 1.0);
          return;
        }
        if (helmet) {
          // Crisp metallic kevlar dink
          AU.noise(0.03, 3600, 2.5, 0.18, 0, 'bandpass');
          AU.tone(2450, 0.075, 0.14, 'triangle', 0, -900);
          AU.tone(1680, 0.065, 0.10, 'sine', 0, -400, 0.01);
        } else {
          // Crisp flesh/crunch impact
          AU.noise(0.04, 1400, 1.1, 0.22, 0, 'bandpass');
          AU.tone(980, 0.07, 0.16, 'triangle', 0, -420);
        }
        return;
      }
      // Subtle body thud confirmation
      AU.noise(0.032, 650, 1.2, 0.15, 0, 'lowpass');
      AU.tone(210, 0.045, 0.10, 'sine', 0, -80);
    };

    AU.step = function (v = 1, pan = 0, kind = 'concrete') {
      if (!AU.ctx || v < 0.01) return;
      setupGraph();
      const foot = (AU.foot = !AU.foot);
      const p = Math.max(-1, Math.min(1, pan + (foot ? 0.06 : -0.06)));
      const f = 0.88 + Math.random() * 0.24;
      if (kind === 'water') {
        AU.noise(0.16, 1650 * f, 0.7, 0.34 * v, p, 'bandpass');
        AU.noise(0.11, 4100 * f, 0.6, 0.14 * v, p, 'highpass', 0.03);
        return;
      }
      if (kind === 'metal') {
        // Hollow steel catwalk / container clank
        AU.noise(0.045, 520 * f, 1.4, 0.42 * v, p, 'bandpass');
        AU.tone(195 * f, 0.075, 0.14 * v, 'triangle', p, -55);
        AU.tone(410 * f, 0.05, 0.06 * v, 'sine', p, -90, 0.01);
        AU.noise(0.03, 2100 * f, 1.8, 0.12 * v, p, 'bandpass', 0.022);
        return;
      }
      if (kind === 'wood') {
        // Warm hollow wooden plank thump
        AU.noise(0.05, 290 * f, 1.3, 0.48 * v, p, 'lowpass');
        AU.tone(115 * f, 0.055, 0.18 * v, 'sine', p, -32);
        AU.noise(0.03, 1200 * f, 1.6, 0.11 * v, p, 'bandpass', 0.025);
        return;
      }
      // Crisp concrete/asphalt grit step
      AU.noise(0.05, 220 * f, 0.9, 0.52 * v, p, 'lowpass');
      AU.tone(74 * f, 0.045, 0.16 * v, 'sine', p, -20);
      AU.noise(0.036, 1650 * f, 1.5, 0.15 * v, p, 'bandpass', 0.024);
      AU.noise(0.022, 3800 * f, 1.2, 0.05 * v, p, 'highpass', 0.028);
    };

    AU.land = function (v = 1, pan = 0, kind = 'concrete') {
      if (!AU.ctx) return;
      setupGraph();
      AU.step(v * 1.35, pan, kind);
      AU.step(v * 0.95, -pan * 0.3, kind);
    };

    AU.scope = function (weapon, skin, zoom) {
      if (!AU.ctx) return;
      setupGraph();
      if (weapon === 'sniper' && samples.awpScope && zoom > 0) {
        playSample(samples.awpScope, 0.55, 0, 1.0);
        return;
      }
      origScope(weapon, skin, zoom);
    };

    AU.kill = function () {
      if (!AU.ctx) return;
      setupGraph();
      // Subtle crisp tactical kill chime (non-intrusive)
      AU.tone(660, 0.08, 0.12, 'sine', 0, 0);
      AU.tone(990, 0.14, 0.13, 'triangle', 0, 0, 0.045);
    };

    AU.freezeTick = function () {
      if (!AU.ctx) return;
      setupGraph();
      AU.noise(0.012, 3200, 1.1, 0.04, 0, 'bandpass');
      AU.tone(1320, 0.045, 0.06, 'sine', 0, -180);
    };

    AU.roundEnd = function () {
      if (!AU.ctx) return;
      setupGraph();
      AU.tone(523.25, 0.14, 0.12, 'triangle');
      AU.tone(659.25, 0.18, 0.12, 'triangle', 0, 0, 0.09);
      AU.tone(783.99, 0.28, 0.14, 'sine', 0, 0, 0.18);
    };

    AU.uiClick = function () {
      if (!AU.ctx) return;
      setupGraph();
      AU.noise(0.014, 2800, 1.6, 0.05, 0, 'bandpass');
      AU.tone(920, 0.025, 0.03, 'sine', 0, -240);
    };
  }

  globalThis.V2Audio = { enhance };
})();
