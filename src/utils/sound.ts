class DraftingSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private lastTickTime = 0;

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (value && !this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (value && this.ctx?.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  /**
   * Subtle mechanical vernier-caliper tick for explode scrubbing.
   */
  playTick(pitchMultiplier = 1.0): void {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTickTime < 0.032) return;
    this.lastTickTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1150 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.018);

    gain.gain.setValueAtTime(0.022, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.022);
  }

  /**
   * Crisp detent click when selecting a component.
   */
  playSelect(): void {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.03);

    gain.gain.setValueAtTime(0.032, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }
}

export const soundEngine = new DraftingSoundEngine();
