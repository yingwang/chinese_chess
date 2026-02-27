// === Sound Manager for Chinese Chess ===
// Uses Web Audio API to generate traditional Chinese-style sounds

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

    // Chinese pentatonic scale frequencies (宫商角徵羽) across octaves
    // C4=262, D4=294, E4=330, G4=392, A4=440
    this.pentatonic = [
      262, 294, 330, 392, 440,      // Octave 4
      523, 587, 659, 784, 880,      // Octave 5
    ];

    // Lower octave for bass accompaniment
    this.bassPentatonic = [
      131, 147, 165, 196, 220,      // Octave 3
    ];
  }

  _ensureContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.audioCtx.destination);

      this.bgMusicGain = this.audioCtx.createGain();
      this.bgMusicGain.gain.value = 0.15;
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

  // Wooden piece placement sound
  playMoveSound() {
    this._ensureContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Short percussive "knock" sound using filtered noise + tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // Add a subtle wood resonance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(400, now);
    osc2.frequency.exponentialRampToValueAtTime(150, now + 0.1);
    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + 0.15);
  }

  // Capture / eat piece sound - more dramatic
  playCaptureSound() {
    this._ensureContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Impact hit
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(600, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    gain1.gain.setValueAtTime(0.6, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Secondary clash
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now);
    osc2.stop(now + 0.15);

    // Low thud
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(150, now);
    osc3.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    gain3.gain.setValueAtTime(0.4, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc3.connect(gain3);
    gain3.connect(this.sfxGain);
    osc3.start(now);
    osc3.stop(now + 0.3);
  }

  // Check (将军) sound - alert tone
  playCheckSound() {
    this._ensureContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Two ascending alert tones
    const notes = [523, 659]; // C5, E5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startTime = now + i * 0.15;
      osc.frequency.setValueAtTime(freq, startTime);

      // Add slight vibrato for Chinese music feel
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.frequency.value = 6;
      vibratoGain.gain.value = freq * 0.02;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start(startTime);
      vibrato.stop(startTime + 0.25);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  // === Background Music ===

  startBackgroundMusic() {
    this._ensureContext();
    if (this.bgMusicPlaying) return;
    this.bgMusicPlaying = true;
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

    this.bgMusicTimer = setTimeout(() => {
      this._scheduleNextPhrase();
    }, phraseDuration * 1000 + 500);
  }

  _playMusicPhrase() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Generate a random phrase using pentatonic scale
    const noteCount = 4 + Math.floor(Math.random() * 5); // 4-8 notes
    let time = now;
    let totalDuration = 0;

    // Pick a starting note from the scale
    let noteIndex = Math.floor(Math.random() * this.pentatonic.length);

    for (let i = 0; i < noteCount; i++) {
      // Move to a nearby note in the scale (stepwise or small leap)
      const step = Math.floor(Math.random() * 5) - 2; // -2 to +2
      noteIndex = Math.max(0, Math.min(this.pentatonic.length - 1, noteIndex + step));

      const freq = this.pentatonic[noteIndex];
      const duration = 0.3 + Math.random() * 0.7; // 0.3 to 1.0 seconds

      this._playBgNote(freq, time, duration);

      time += duration;
      totalDuration += duration;
    }

    // Occasional bass note
    if (Math.random() > 0.4) {
      const bassFreq = this.bassPentatonic[Math.floor(Math.random() * this.bassPentatonic.length)];
      this._playBgNote(bassFreq, now, totalDuration * 0.8, 0.5);
    }

    return totalDuration;
  }

  _playBgNote(freq, startTime, duration, gainMultiplier = 1.0) {
    const ctx = this.audioCtx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Use sine wave for gentle Chinese flute-like tone
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    // Add gentle vibrato (characteristic of Chinese music)
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 5 + Math.random() * 2; // 5-7 Hz vibrato
    vibratoGain.gain.value = freq * 0.015;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    // Envelope: gentle attack, sustain, gentle release
    const attackTime = 0.05;
    const releaseTime = Math.min(0.15, duration * 0.3);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.6 * gainMultiplier, startTime + attackTime);
    gain.gain.setValueAtTime(0.6 * gainMultiplier, startTime + duration - releaseTime);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);
    gain.connect(this.bgMusicGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
    vibrato.start(startTime);
    vibrato.stop(startTime + duration + 0.01);

    // Track nodes for cleanup
    this.bgMusicNodes.push(osc, vibrato);

    // Auto-cleanup references after note finishes
    osc.onended = () => {
      const idx = this.bgMusicNodes.indexOf(osc);
      if (idx >= 0) this.bgMusicNodes.splice(idx, 1);
    };
    vibrato.onended = () => {
      const idx = this.bgMusicNodes.indexOf(vibrato);
      if (idx >= 0) this.bgMusicNodes.splice(idx, 1);
    };
  }
}
