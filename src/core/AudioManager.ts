export class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private isPlaying: boolean = false;
  
  private sfxBuffers: Map<string, AudioBuffer> = new Map();
  private sfxVolume: number = 0.8;

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
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
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
    return (this.audioContext.currentTime - this.startTime) * 1000;
  }

  public stop() {
    if (this.source) {
      this.source.stop();
      this.isPlaying = false;
    }
  }
}
