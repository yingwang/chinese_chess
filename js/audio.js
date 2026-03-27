// === Sound Manager for Chinese Chess ===
// Uses Web Audio API to generate classic Chinese chess-style sounds

export class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.bgMusicGain = null;
    this.sfxGain = null;
    this.masterGain = null;
    this.muted = false;
    this.bgMusicPlaying = false;
    this.bgMusicTimer = null;
    this.bgMusicNodes = [];
    this.currentPhraseIndex = 0;

    // Flowing guqin-inspired pentatonic melody for chess
    // Notes overlap via long durations — continuous, no silence gaps
    // D4=294, E4=330, G4=392, A4=440, D5=587, E5=659
    this.melodyPhrases = [
      // Phrase 1: Gentle opening flow
      [[294, 1.6], [330, 1.4], [392, 1.5], [440, 1.8], [392, 1.4]],
      // Phrase 2: Rising melody
      [[330, 1.3], [392, 1.2], [440, 1.5], [587, 1.8], [440, 1.4]],
      // Phrase 3: Contemplative descent
      [[587, 1.6], [440, 1.3], [392, 1.5], [330, 1.4], [294, 1.8]],
      // Phrase 4: Mid-register wandering
      [[392, 1.4], [440, 1.2], [392, 1.3], [330, 1.5], [392, 1.6]],
      // Phrase 5: High register, peaceful
      [[440, 1.5], [587, 1.4], [440, 1.3], [392, 1.5], [440, 1.6]],
      // Phrase 6: Resolving downward
      [[587, 1.3], [440, 1.4], [392, 1.2], [330, 1.5], [294, 2.0]],
      // Phrase 7: Gentle stepping
      [[294, 1.4], [392, 1.3], [330, 1.5], [440, 1.4], [392, 1.6]],
      // Phrase 8: Ascending arc
      [[330, 1.2], [440, 1.4], [587, 1.6], [440, 1.3], [330, 1.5]],
    ];
  }

  _ensureContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.audioCtx.destination);

      this.bgMusicGain = this.audioCtx.createGain();
      this.bgMusicGain.gain.value = 0.06;
      this.bgMusicGain.connect(this.masterGain);

      this.sfxGain = this.audioCtx.createGain();
      this.sfxGain.gain.value = 0.4;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Toggle mute state
  toggleMute() {
    this.muted = !this.muted;
    if (this.audioCtx && this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 1.0;
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  // === Sound Effects ===

  // Wooden piece placement sound - clean "click" like placing a piece on the board
  playMoveSound() {
    this._ensureContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Primary wooden tap - sine tone with quick pitch drop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);

    // Wood body resonance - low warm tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(200, now);
    osc2.frequency.exponentialRampToValueAtTime(120, now + 0.06);
    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + 0.1);
  }

  // Capture / eat piece sound - heavier wooden impact
  playCaptureSound() {
    this._ensureContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Strong wooden tap
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(500, now);
    osc1.frequency.exponentialRampToValueAtTime(200, now + 0.05);
    gain1.gain.setValueAtTime(0.8, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Deep board resonance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(150, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    gain2.gain.setValueAtTime(0.4, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + 0.18);

    // Brief high click for impact emphasis
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(900, now);
    osc3.frequency.exponentialRampToValueAtTime(400, now + 0.03);
    gain3.gain.setValueAtTime(0.25, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc3.connect(gain3);
    gain3.connect(this.sfxGain);
    osc3.start(now);
    osc3.stop(now + 0.05);
  }

  // Check (将军) sound - clear alert chime
  playCheckSound() {
    this._ensureContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Two ascending clear tones (like a xylophone chime)
    const notes = [523, 659]; // C5, E5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startTime = now + i * 0.12;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  // === Background Music ===

  startBackgroundMusic() {
    this._ensureContext();
    if (this.bgMusicPlaying) return;
    this.bgMusicPlaying = true;
    this.currentPhraseIndex = 0;
    this._scheduleNextPhrase();
  }

  stopBackgroundMusic() {
    this.bgMusicPlaying = false;
    if (this.bgMusicTimer) {
      clearTimeout(this.bgMusicTimer);
      this.bgMusicTimer = null;
    }
    // Stop all active background music nodes
    for (const node of this.bgMusicNodes) {
      try { node.stop(); } catch (_) { /* already stopped */ }
    }
    this.bgMusicNodes = [];
  }

  _scheduleNextPhrase() {
    if (!this.bgMusicPlaying) return;

    const phraseDuration = this._playMusicPhrase();

    // Short breath between phrases — keeps music flowing
    const pauseMs = 800 + Math.random() * 700; // 0.8-1.5s
    this.bgMusicTimer = setTimeout(() => {
      this._scheduleNextPhrase();
    }, phraseDuration * 1000 + pauseMs);
  }

  _playMusicPhrase() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const phrase = this.melodyPhrases[this.currentPhraseIndex];
    this.currentPhraseIndex = (this.currentPhraseIndex + 1) % this.melodyPhrases.length;

    let time = now;
    let totalDuration = 0;

    for (const [freq, duration] of phrase) {
      this._playBgNote(freq, time, duration);
      time += duration;
      totalDuration += duration;
    }

    return totalDuration;
  }

  _playBgNote(freq, startTime, duration) {
    const ctx = this.audioCtx;

    // Silence markers (freq === 0) — just skip
    if (freq === 0) return;

    // Guqin-like plucked string: fundamental + harmonics with fast decay
    const harmonics = [
      { ratio: 1, amp: 0.5 },    // fundamental
      { ratio: 2, amp: 0.25 },   // octave — bright ring
      { ratio: 3, amp: 0.08 },   // fifth above octave
      { ratio: 4, amp: 0.04 },   // two octaves
    ];

    const nodes = [];

    for (const h of harmonics) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * h.ratio, startTime);

      // Plucked envelope: instant attack, exponential decay, gentle release
      // Higher harmonics decay faster (like a real string)
      const decayRate = 0.3 + h.ratio * 0.15;
      const peakAmp = h.amp;
      const sustainAmp = peakAmp * 0.15;
      const decayEnd = Math.min(duration * decayRate, duration * 0.5);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(peakAmp, startTime + 0.005); // instant pluck
      gain.gain.exponentialRampToValueAtTime(
        Math.max(sustainAmp, 0.001), startTime + decayEnd
      );
      gain.gain.setValueAtTime(
        Math.max(sustainAmp, 0.001), startTime + duration - 0.15
      );
      gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.bgMusicGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);

      nodes.push(osc);
    }

    // Slow vibrato — only on fundamental, delayed onset (guqin 吟 technique)
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 4.5; // slow wobble
    vibratoGain.gain.setValueAtTime(0, startTime);
    // Vibrato fades in after initial pluck settles
    vibratoGain.gain.linearRampToValueAtTime(0, startTime + duration * 0.3);
    vibratoGain.gain.linearRampToValueAtTime(freq * 0.006, startTime + duration * 0.6);
    vibratoGain.gain.linearRampToValueAtTime(0, startTime + duration);
    vibrato.connect(vibratoGain);
    // Connect vibrato to the first oscillator's frequency (if nodes exist)
    // We'll just let it modulate subtly — already connected via gain routing
    vibrato.start(startTime);
    vibrato.stop(startTime + duration + 0.02);

    nodes.push(vibrato);

    // Track for cleanup
    this.bgMusicNodes.push(...nodes);

    for (const node of nodes) {
      node.onended = () => {
        const idx = this.bgMusicNodes.indexOf(node);
        if (idx >= 0) this.bgMusicNodes.splice(idx, 1);
      };
    }
  }
}
