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

    // Pre-composed melodic phrases using pentatonic scale (宫商角徵羽)
    // Each phrase is an array of [frequency, duration] pairs
    // D4=294, E4=330, G4=392, A4=440
    // D5=587, E5=659, G5=784, A5=880
    this.melodyPhrases = [
      // Phrase 1: Gentle descending guzheng-style opening
      [[587, 0.6], [440, 0.4], [392, 0.6], [330, 0.8], [294, 1.0]],
      // Phrase 2: Rising and settling
      [[330, 0.5], [392, 0.5], [440, 0.6], [392, 0.4], [330, 0.8]],
      // Phrase 3: Contemplative middle phrase
      [[392, 0.6], [440, 0.5], [587, 0.7], [440, 0.5], [392, 0.9]],
      // Phrase 4: Gentle stepping pattern
      [[294, 0.5], [330, 0.5], [392, 0.7], [330, 0.5], [294, 0.8]],
      // Phrase 5: Higher register, peaceful
      [[440, 0.6], [587, 0.5], [440, 0.4], [392, 0.6], [330, 0.9]],
      // Phrase 6: Closing / resting phrase
      [[392, 0.5], [330, 0.6], [294, 0.7], [330, 0.4], [294, 1.2]],
    ];
  }

  _ensureContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.audioCtx.destination);

      this.bgMusicGain = this.audioCtx.createGain();
      this.bgMusicGain.gain.value = 0.08;
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

    // Longer pause between phrases for a calm, unhurried feel
    this.bgMusicTimer = setTimeout(() => {
      this._scheduleNextPhrase();
    }, phraseDuration * 1000 + 2000);
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

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Gentle sine wave tone
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    // Subtle vibrato for warmth
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 5;
    vibratoGain.gain.value = freq * 0.008;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    // Smooth envelope: gentle attack, sustain, gentle release
    const attackTime = 0.08;
    const releaseTime = Math.min(0.2, duration * 0.3);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.5, startTime + attackTime);
    gain.gain.setValueAtTime(0.5, startTime + duration - releaseTime);
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
