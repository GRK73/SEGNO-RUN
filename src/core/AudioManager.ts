export class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private isPlaying: boolean = false;
  
  private sfxBuffers: Map<string, AudioBuffer> = new Map();
  private sfxVolume: number = 0.8;
  private offset: number = 0;

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

  public playIntro() {
    if (!this.audioContext || !this.introBuffer) return;
    
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
      try { this.introSource?.stop(); } catch(e){}
    }, durationMs + 100);
  }

  public play() {
    if (!this.audioContext || !this.audioBuffer) return;
    
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.audioContext.destination);
    
    this.startTime = this.audioContext.currentTime;
    this.source.start(0);
    this.isPlaying = true;
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

  public stop() {
    if (this.source) {
      this.source.stop();
      this.isPlaying = false;
    }
  }
}
