/**
 * VisionPath AI - 3D Spatial Audio & Voice Ergonomics Engine
 * Delivers binaural directional sound cues (Web Audio API) and throttled voice instructions (SpeechSynthesis).
 */

class SpatialAudioEngine {
  constructor() {
    this.ctx = null;
    this.panner = null;
    this.gainNode = null;
    this.isMuted = false;
    this.voiceEnabled = true;
    this.lastSpokenText = "";
    this.lastSpokenTime = 0;
    this.speechThrottleMs = 3500; // Prevent sensory cognitive overload
    this.pingInterval = null;
    this.currentPan = 0; // -1 (Left), 0 (Center), +1 (Right)
    this.currentRateHz = 1.0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.2, this.ctx.currentTime);

      // Stereo Panner or 3D Panner
      if (this.ctx.createStereoPanner) {
        this.panner = this.ctx.createStereoPanner();
        this.gainNode.connect(this.panner);
        this.panner.connect(this.ctx.destination);
      } else {
        this.gainNode.connect(this.ctx.destination);
      }
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playSpatialPing(pan = 0, frequency = 540, duration = 0.08) {
    if (this.isMuted) return;
    this.init();

    try {
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

      // Set Stereo Panning
      if (this.panner && this.panner.pan) {
        this.panner.pan.setValueAtTime(pan, this.ctx.currentTime);
      }

      const now = this.ctx.currentTime;
      noteGain.gain.setValueAtTime(0.18, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(noteGain);
      noteGain.connect(this.gainNode);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn("Audio ping error:", e);
    }
  }

  updateAudioRadar(pan, rateHz, urgent = false) {
    this.currentPan = pan;
    this.currentRateHz = rateHz;

    // Animate Modern Equalizer Sound Bars
    const leftBars = document.querySelectorAll("#left-sound-bars .sound-bar");
    const rightBars = document.querySelectorAll("#right-sound-bars .sound-bar");

    const animateBars = (bars, multiplier, color) => {
      bars.forEach((bar, idx) => {
        const baseHeight = [6, 14, 20, 12, 8][idx % 5];
        const jitter = Math.floor(Math.random() * 6);
        const targetHeight = Math.max(4, Math.min(24, Math.round(baseHeight * multiplier + jitter)));
        bar.style.height = `${targetHeight}px`;
        bar.style.background = color;
      });
    };

    if (pan < -0.2) {
      // Panned heavily to Left Ear
      animateBars(leftBars, 1.2, "var(--accent-cyan)");
      animateBars(rightBars, 0.35, "rgba(255,255,255,0.2)");
    } else if (pan > 0.2) {
      // Panned heavily to Right Ear
      animateBars(leftBars, 0.35, "rgba(255,255,255,0.2)");
      animateBars(rightBars, 1.2, "var(--accent-cyan)");
    } else {
      // Centered Balanced Walking Heartbeat
      animateBars(leftBars, 0.7, "var(--accent-blue)");
      animateBars(rightBars, 0.7, "var(--accent-blue)");
    }

    if (urgent) {
      this.playSpatialPing(pan, 880, 0.12);
    } else {
      this.playSpatialPing(pan, 480, 0.06);
    }
  }

  speak(text, priority = false) {
    if (!this.voiceEnabled || !window.speechSynthesis) return;

    const now = Date.now();
    if (!priority && text === this.lastSpokenText && now - this.lastSpokenTime < this.speechThrottleMs) {
      return;
    }

    window.speechSynthesis.cancel(); // Stop backlog
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05; // Slightly brisk for real-time responsiveness
    utterance.pitch = 1.0;
    utterance.lang = "en-US";

    window.speechSynthesis.speak(utterance);
    this.lastSpokenText = text;
    this.lastSpokenTime = now;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  toggleVoice() {
    this.voiceEnabled = !this.voiceEnabled;
    return this.voiceEnabled;
  }
}

window.spatialAudio = new SpatialAudioEngine();

