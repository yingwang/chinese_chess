// === Sound Manager for Chinese Chess ===
// Uses Web Audio API to generate classic Chinese chess-style sounds

export class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.sfxGain = null;
    this.masterGain = null;
    this.muted = false;
    this.bgMusicPlaying = false;

    // Background music uses HTML Audio element for proper WAV playback
    this.bgAudio = new Audio('bgm.wav');
    this.bgAudio.loop = true;
    this.bgAudio.volume = 0.2;
  }

  _ensureContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.audioCtx.destination);

      this.sfxGain = this.audioCtx.createGain();
      this.sfxGain.gain.value = 0.4;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    // Apply mute state if it was set before context was created
    if (this.muted && this.masterGain) {
      this.masterGain.gain.value = 0;
    }
  }

  // Toggle mute state
  toggleMute() {
    this.muted = !this.muted;
    if (this.audioCtx && this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 1.0;
    }
    this.bgAudio.muted = this.muted;
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

  // === Background Music (WAV file) ===

  startBackgroundMusic() {
    if (this.bgMusicPlaying) return;
    this.bgMusicPlaying = true;
    this.bgAudio.currentTime = 0;
    this.bgAudio.play().catch(() => {});
  }

  stopBackgroundMusic() {
    this.bgMusicPlaying = false;
    this.bgAudio.pause();
  }
}
