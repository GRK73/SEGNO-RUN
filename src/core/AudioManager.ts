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
  private masterGain: GainNode | null = null;
  private masterVolume: number = parseFloat(localStorage.getItem('masterVolume') ?? '1');
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
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.audioContext.destination);
    this.mainGain = this.audioContext.createGain();
    this.mainGain.connect(this.masterGain);
  }

  public warmup() {
    if (!this.audioContext) this.init();
    if (this.audioContext!.state === 'suspended') {
      this.audioContext!.resume();
    }
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('masterVolume', String(this.masterVolume));
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);
    }
  }

  public getMasterVolume(): number { return this.masterVolume; }

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
    this.introGain.connect(this.masterGain ?? this.audioContext.destination);
    
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

  // delaySeconds 후 재생 예약. isPlaying=true로 설정하므로 getCurrentTimeMS()가
  // 즉시 음수값을 반환하기 시작해 점프 없는 seamless 전환을 보장함.
  public playScheduled(delaySeconds: number) {
    if (!this.audioContext || !this.audioBuffer) return;

    if (!this.mainGain) {
      this.mainGain = this.audioContext.createGain();
      this.mainGain.connect(this.masterGain ?? this.audioContext.destination);
    }

    const now = this.audioContext.currentTime;
    this.mainGain.gain.cancelScheduledValues(now);
    this.mainGain.gain.setValueAtTime(1, now);

    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.mainGain);

    this.startTime = now + delaySeconds;
    this.source.start(this.startTime);
    this.isPlaying = true;
  }

  public fadeOutMain(durationMs: number = 3000) {
    if (!this.mainGain || !this.source || !this.audioContext) return;
    if (this.fadeInterval) { clearInterval(this.fadeInterval); this.fadeInterval = null; }

    const now = this.audioContext.currentTime;
    const end = now + durationMs / 1000;
    this.mainGain.gain.cancelScheduledValues(now);
    this.mainGain.gain.setValueAtTime(this.mainGain.gain.value, now);
    this.mainGain.gain.linearRampToValueAtTime(0, end);

    const source = this.source;
    this.fadeInterval = setTimeout(() => {
      this.fadeInterval = null;
      try { source.stop(); source.disconnect(); } catch { /* ignore */ }
      this.isPlaying = false;
    }, durationMs) as unknown as ReturnType<typeof setInterval>;
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

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.sfxVolume;
    gainNode.connect(this.audioContext.destination);

    const source = this.audioContext.createBufferSource();
    source.buffer = this.sfxBuffers.get(name)!;
    source.connect(gainNode);
    source.onended = () => { source.disconnect(); gainNode.disconnect(); };
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
      clearTimeout(this.fadeInterval as unknown as ReturnType<typeof setTimeout>);
      this.fadeInterval = null;
    }
    if (this.source) {
      try { this.source.stop(); this.source.disconnect(); } catch { /* ignore */ }
      this.isPlaying = false;
    }
    if (this.introSource) {
      try { this.introSource.stop(); this.introSource.disconnect(); } catch { /* ignore */ }
      this.introSource = null;
    }
    if (this.introGain) {
      try { this.introGain.disconnect(); } catch { /* ignore */ }
      this.introGain = null;
    }
  }
}
