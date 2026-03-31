export class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private mainGain: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private isPlaying: boolean = false;
  
  private sfxBuffers: Map<string, AudioBuffer> = new Map();
  private sfxVolume: number = 0.8;
  private offset: number = 0;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;

  // Intro Sequence
  private introBuffer: AudioBuffer | null = null;
  private introSource: AudioBufferSourceNode | null = null;
  private introGain: GainNode | null = null;

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init() {
    this.audioContext = new AudioContext({ latencyHint: 'interactive' });
    this.mainGain = this.audioContext.createGain();
    this.mainGain.connect(this.audioContext.destination);
  }

  public async loadAudio(url: string) {
    if (!this.audioContext) this.init();
    
    // Load both main song and intro song concurrently
    const [mainRes, introRes] = await Promise.all([
      fetch(url).catch(() => null),
      fetch(`${import.meta.env.BASE_URL}assets/audio/startsong.mp3`).catch(() => null)
    ]);
    
    if (mainRes) {
      const arrayBuffer = await mainRes.arrayBuffer();
      this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    }
    
    if (introRes && !this.introBuffer) {
      const arrayBuffer = await introRes.arrayBuffer();
      this.introBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    }
  }

  public async playIntro() {
    if (!this.audioContext || !this.introBuffer) return;
    await this.resume();
    
    this.introSource = this.audioContext.createBufferSource();
    this.introSource.buffer = this.introBuffer;
    this.introGain = this.audioContext.createGain();
    
    this.introGain.gain.setValueAtTime(1, this.audioContext.currentTime);
    this.introSource.connect(this.introGain);
    this.introGain.connect(this.audioContext.destination);
    
    this.introSource.start(0);
  }

  public fadeOutIntro(durationMs: number = 500) {
    if (!this.audioContext || !this.introGain || !this.introSource) return;
    
    const now = this.audioContext.currentTime;
    this.introGain.gain.setValueAtTime(1, now);
    this.introGain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
    
    setTimeout(() => {
      try { this.introSource?.stop(); } catch { /* ignore */ }
    }, durationMs + 100);
  }

  public async play() {
    if (!this.audioContext || !this.audioBuffer) return;
    await this.resume();
    
    // Ensure mainGain exists
    if (!this.mainGain) {
      this.mainGain = this.audioContext.createGain();
      this.mainGain.connect(this.audioContext.destination);
    }
    
    // Reset volume to max before playing
    const now = this.audioContext.currentTime;
    this.mainGain.gain.cancelScheduledValues(now);
    this.mainGain.gain.value = 1;
    this.mainGain.gain.setValueAtTime(1, now);
    
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.mainGain);
    
    this.startTime = now;
    this.source.start(0);
    this.isPlaying = true;
  }

  public fadeOutMain(durationMs: number = 3000) {
    if (!this.mainGain || !this.source || !this.audioContext) return;
    
    const steps = 30;
    const stepTime = durationMs / steps;
    let currentStep = 0;
    
    // Clear any existing fade
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    
    const targetGain = this.mainGain.gain;
    const targetSource = this.source;
    
    // CRITICAL: Cancel scheduled values so manual .value assignment works!
    targetGain.cancelScheduledValues(0);
    
    this.fadeInterval = setInterval(() => {
      currentStep++;
      const newVolume = Math.max(0, 1 - (currentStep / steps));
      
      // Update volume safely
      try {
        targetGain.value = newVolume;
      } catch { /* ignore */ }
      
      if (currentStep >= steps) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        try { 
          targetSource.stop(); 
          targetSource.disconnect();
        } catch { /* ignore */ }
        this.isPlaying = false;
      }
    }, stepTime);
  }

  public async loadSFX(name: string, url: string) {
    if (!this.audioContext) this.init();
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.sfxBuffers.set(name, buffer);
    } catch (e) {
      console.error(`[AudioManager] Failed to load SFX: ${name}`, e);
    }
  }

  public playSFX(name: string) {
    if (!this.audioContext || !this.sfxBuffers.has(name)) return;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = this.sfxBuffers.get(name)!;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.sfxVolume; // Set volume to 80%
    
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start(0);
  }

  public getCurrentTimeMS(): number {
    if (!this.isPlaying || !this.audioContext) return 0;
    return (this.audioContext.currentTime - this.startTime) * 1000 + this.offset;
  }

  public setOffset(ms: number) {
    this.offset = ms;
  }

  public pause() {
    if (this.audioContext?.state === 'running') {
      this.audioContext.suspend();
    }
  }

  public async resume() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public stop() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (this.source) {
      try { this.source.stop(); } catch { /* ignore */ }
      this.isPlaying = false;
    }
  }
}
