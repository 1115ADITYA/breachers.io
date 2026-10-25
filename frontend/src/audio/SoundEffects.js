/**
 * SoundEffects.js
 * High-performance, zero-asset procedural Web Audio synthesizer for Breachers.io signature sound effects.
 * Includes barrel fuse sizzle, heavy sub-bass explosions, rubber bounce boosts, ammo pickups, and kill confirmations.
 */
export class SoundEffects {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.volume = 0.8;
  }

  init() {
    if (this.audioCtx) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    } catch (e) {
      console.warn('[SoundEffects] Web Audio unavailable:', e);
    }
  }

  resume() {
    if (!this.audioCtx) {
      this.init();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  /**
   * Procedural sizzling fuse sound for explosive barrels
   */
  playFuseSound() {
    this.resume();
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;

    const bufferSize = this.audioCtx.sampleRate * 0.6;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (0.8 + 0.2 * Math.sin(i * 0.05));
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500, t);
    filter.Q.setValueAtTime(4.0, t);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.6);
  }

  /**
   * Heavy explosion with sub-bass punch, distorted noise rumble, and distance attenuation
   */
  playExplosionSound(distance = 0) {
    this.resume();
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;

    // Distance falloff (max audible range ~60m)
    const atten = Math.max(0.05, 1.0 - Math.min(distance, 60.0) / 60.0);
    const vol = atten * 1.2;

    // 1. Sub-bass punch oscillator (140Hz -> 35Hz drop)
    const subOsc = this.audioCtx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(35, t + 0.5);

    const subGain = this.audioCtx.createGain();
    subGain.gain.setValueAtTime(vol * 0.9, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 0.8);

    // 2. Mid punch oscillator (80Hz square crunch)
    const midOsc = this.audioCtx.createOscillator();
    midOsc.type = 'triangle';
    midOsc.frequency.setValueAtTime(90, t);
    midOsc.frequency.exponentialRampToValueAtTime(25, t + 0.35);

    const midGain = this.audioCtx.createGain();
    midGain.gain.setValueAtTime(vol * 0.6, t);
    midGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    midOsc.connect(midGain);
    midGain.connect(this.masterGain);
    midOsc.start(t);
    midOsc.stop(t + 0.4);

    // 3. Low-pass filtered noise rumble
    const bufSize = this.audioCtx.sampleRate * 1.2;
    const buf = this.audioCtx.createBuffer(1, bufSize, this.audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buf;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 1.1);

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 1.2);
  }

  /**
   * Resonant springy bounce boost sound
   */
  playBounceSound() {
    this.resume();
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    // Frequency sweep upward (130Hz -> 380Hz -> 260Hz)
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.28);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  /**
   * Crisp two-tone ammo pickup chime
   */
  playPickupSound() {
    this.resume();
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;

    const playTone = (freq, startOffset, duration) => {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + startOffset);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.35, t + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.01, t + startOffset + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + startOffset);
      osc.stop(t + startOffset + duration);
    };

    playTone(523.25, 0.0, 0.12); // C5
    playTone(659.25, 0.08, 0.18); // E5
    playTone(783.99, 0.16, 0.25); // G5
  }

  /**
   * Heavy, crunchy elimination / kill confirmation sound
   */
  playKillSound() {
    this.resume();
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.25);

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.28);
  }
}

export const sounds = new SoundEffects();
