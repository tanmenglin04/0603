import { AudioSynthesizer } from './synthesizer';

export type GameScene = 'menu' | 'battle_intro' | 'battle_loop' | 'victory' | 'defeat';
export type AudioLayer = 'music' | 'ambient' | 'battle_hint' | 'sfx' | 'ui';
export type SpellType = 'fireball' | 'thunder_strike' | 'heal' | 'vine_whip' | 'combo';

export interface AudioLayerState {
  gain: number;
  muted: boolean;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export interface AudioResource {
  id: string;
  name: string;
  type: 'bgm' | 'sfx' | 'ambient';
  src?: string;
  synthType?: string;
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private synthesizer: AudioSynthesizer;
  private masterGain: GainNode | null = null;
  private layerGains: Record<AudioLayer, GainNode> = {} as Record<AudioLayer, GainNode>;
  private settings: AudioSettings = {
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
  };

  private currentScene: GameScene = 'menu';
  private sceneTransitioning = false;

  private menuMusic: ReturnType<AudioSynthesizer['createMenuMusic']> | null = null;
  private battleLoop: ReturnType<AudioSynthesizer['createBattleLoop']> | null = null;
  private ambientDrone: ReturnType<AudioSynthesizer['createAmbientDrone']> | null = null;
  private heartbeat: ReturnType<AudioSynthesizer['createHeartbeatSound']> | null = null;
  private heartbeatPlaying = false;

  private fireSound: ReturnType<AudioSynthesizer['createFireSound']> | null = null;
  private thunderSound: ReturnType<AudioSynthesizer['createThunderSound']> | null = null;
  private waterSound: ReturnType<AudioSynthesizer['createWaterSound']> | null = null;

  private resourceRegistry: Map<string, AudioResource> = new Map();
  private externalBuffers: Map<string, AudioBuffer> = new Map();

  private onSettingsChange: ((settings: AudioSettings) => void) | null = null;

  constructor() {
    this.synthesizer = new AudioSynthesizer();
  }

  private isReady(): boolean {
    return this.audioContext !== null;
  }

  async init(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.synthesizer.init(this.audioContext);

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;

    const layers: AudioLayer[] = ['music', 'ambient', 'battle_hint', 'sfx', 'ui'];
    layers.forEach((layer) => {
      const gain = this.audioContext!.createGain();
      const vol = layer === 'music' ? this.settings.musicVolume : this.settings.sfxVolume;
      gain.gain.value = vol;
      gain.connect(this.masterGain!);
      this.layerGains[layer] = gain;
    });

    this.masterGain.connect(this.audioContext.destination);

    this.initSoundGenerators();
  }

  private initSoundGenerators(): void {
    if (!this.audioContext) return;

    this.menuMusic = this.synthesizer.createMenuMusic();
    this.menuMusic.connect(this.layerGains.music);

    this.battleLoop = this.synthesizer.createBattleLoop();
    this.battleLoop.connect(this.layerGains.music);

    this.ambientDrone = this.synthesizer.createAmbientDrone();
    this.ambientDrone.connect(this.layerGains.ambient);

    this.heartbeat = this.synthesizer.createHeartbeatSound();
    this.heartbeat.connect(this.layerGains.battle_hint);

    this.fireSound = this.synthesizer.createFireSound();
    this.fireSound.connect(this.layerGains.sfx);

    this.thunderSound = this.synthesizer.createThunderSound();
    this.thunderSound.connect(this.layerGains.sfx);

    this.waterSound = this.synthesizer.createWaterSound();
    this.waterSound.connect(this.layerGains.sfx);
  }

  async resume(): Promise<void> {
    if (!this.isReady()) return;
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setOnSettingsChange(callback: (settings: AudioSettings) => void): void {
    this.onSettingsChange = callback;
  }

  setMasterVolume(volume: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateGains();
    this.notifySettingsChange();
  }

  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateGains();
    this.notifySettingsChange();
  }

  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateGains();
    this.notifySettingsChange();
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.updateGains();
    this.notifySettingsChange();
  }

  toggleMuted(): void {
    this.setMuted(!this.settings.muted);
  }

  private updateGains(): void {
    if (!this.masterGain || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const targetMaster = this.settings.muted ? 0 : this.settings.masterVolume;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(targetMaster, now + 0.1);

    this.layerGains.music.gain.cancelScheduledValues(now);
    this.layerGains.music.gain.linearRampToValueAtTime(this.settings.musicVolume, now + 0.1);

    this.layerGains.sfx.gain.cancelScheduledValues(now);
    this.layerGains.sfx.gain.linearRampToValueAtTime(this.settings.sfxVolume, now + 0.05);

    this.layerGains.ui.gain.cancelScheduledValues(now);
    this.layerGains.ui.gain.linearRampToValueAtTime(this.settings.sfxVolume, now + 0.05);

    this.layerGains.battle_hint.gain.cancelScheduledValues(now);
    this.layerGains.battle_hint.gain.linearRampToValueAtTime(this.settings.musicVolume, now + 0.1);

    this.layerGains.ambient.gain.cancelScheduledValues(now);
    this.layerGains.ambient.gain.linearRampToValueAtTime(this.settings.musicVolume * 0.6, now + 0.1);
  }

  private notifySettingsChange(): void {
    if (this.onSettingsChange) {
      this.onSettingsChange({ ...this.settings });
    }
  }

  getCurrentScene(): GameScene {
    return this.currentScene;
  }

  async transitionToScene(scene: GameScene): Promise<void> {
    if (!this.isReady()) return;
    if (this.sceneTransitioning || scene === this.currentScene) return;
    this.sceneTransitioning = true;

    try {
      const prevScene = this.currentScene;
      this.currentScene = scene;

      switch (prevScene) {
        case 'menu':
          this.menuMusic?.stop();
          break;
        case 'battle_intro':
        case 'battle_loop':
          this.battleLoop?.stop();
          this.ambientDrone?.stop();
          this.stopHeartbeat();
          break;
      }

      await this.wait(300);

      switch (scene) {
        case 'menu':
          this.menuMusic?.start();
          break;
        case 'battle_intro':
          this.ambientDrone?.start();
          await this.wait(1500);
          this.battleLoop?.start();
          this.battleLoop?.setIntensity(0.3);
          break;
        case 'battle_loop':
          this.battleLoop?.start();
          this.ambientDrone?.start();
          this.battleLoop?.setIntensity(0.5);
          break;
        case 'victory':
          this.playVictory();
          break;
        case 'defeat':
          this.playDefeat();
          break;
      }
    } finally {
      this.sceneTransitioning = false;
    }
  }

  setBattleIntensity(intensity: number): void {
    if (!this.isReady()) return;
    this.battleLoop?.setIntensity(Math.max(0, Math.min(1, intensity)));
  }

  updatePlayerHp(hpPercent: number): void {
    if (!this.isReady()) return;
    if (this.currentScene !== 'battle_loop' && this.currentScene !== 'battle_intro') return;

    if (hpPercent <= 0.3) {
      const intensity = hpPercent / 0.3;
      this.battleLoop?.setIntensity(0.1 + intensity * 0.2);

      if (!this.heartbeatPlaying && this.heartbeat) {
        this.heartbeat.play();
        this.heartbeatPlaying = true;
      }
    } else {
      const intensity = Math.min(1, 0.4 + (hpPercent - 0.3) * 0.857);
      this.battleLoop?.setIntensity(intensity);

      if (this.heartbeatPlaying) {
        this.stopHeartbeat();
      }
    }
  }

  private stopHeartbeat(): void {
    this.heartbeat?.stop();
    this.heartbeatPlaying = false;
  }

  playSpell(spellType: SpellType, comboCount: number = 1): void {
    if (!this.isReady()) return;
    try {
      this.resume();

      const pitchBoost = comboCount >= 3 ? Math.min((comboCount - 2) * 0.1, 0.5) : 0;

      switch (spellType) {
        case 'fireball':
          this.fireSound?.start();
          setTimeout(() => this.fireSound?.stop(), 400 + pitchBoost * 200);
          if (comboCount >= 3) {
            this.synthesizer.playSweep({
              startFreq: 400 * (1 + pitchBoost),
              endFreq: 1200 * (1 + pitchBoost),
              duration: 0.3,
              gain: 0.25,
              waveform: 'sawtooth',
            });
          }
          this.synthesizer.playHit();
          break;

        case 'thunder_strike':
          this.thunderSound?.play();
          if (comboCount >= 3) {
            setTimeout(() => this.thunderSound?.play(), 150);
            this.synthesizer.playSweep({
              startFreq: 2000 * (1 + pitchBoost),
              endFreq: 5000 * (1 + pitchBoost),
              duration: 0.2,
              gain: 0.2,
              waveform: 'square',
            });
          }
          break;

        case 'heal':
          this.waterSound?.start();
          setTimeout(() => this.waterSound?.stop(), 600);
          this.synthesizer.playHeal();
          if (comboCount >= 3) {
            setTimeout(() => this.synthesizer.playHeal(), 200);
          }
          break;

        case 'vine_whip':
          this.synthesizer.playSequence([
            { frequency: 200 * (1 + pitchBoost), duration: 0.08, gain: 0.25, waveform: 'sawtooth' },
            { frequency: 300 * (1 + pitchBoost), duration: 0.1, gain: 0.2, waveform: 'sine', delay: 0.05 },
            { frequency: 250 * (1 + pitchBoost), duration: 0.08, gain: 0.22, waveform: 'triangle', delay: 0.12 },
          ]);
          this.synthesizer.playHit();
          if (comboCount >= 3) {
            this.synthesizer.playSequence([
              { frequency: 350 * (1 + pitchBoost), duration: 0.1, gain: 0.2, waveform: 'sine', delay: 0.2 },
              { frequency: 500 * (1 + pitchBoost), duration: 0.15, gain: 0.18, waveform: 'triangle', delay: 0.3 },
            ]);
          }
          break;

        case 'combo':
          this.synthesizer.playCriticalHit();
          if (comboCount >= 3) {
            this.synthesizer.playSequence([
              { frequency: 440 * (1 + pitchBoost), duration: 0.1, gain: 0.25, waveform: 'square' },
              { frequency: 660 * (1 + pitchBoost), duration: 0.1, gain: 0.28, waveform: 'square', delay: 0.08 },
              { frequency: 880 * (1 + pitchBoost), duration: 0.15, gain: 0.3, waveform: 'triangle', delay: 0.16 },
            ]);
          }
          break;
      }
    } catch (e) {
      // 静默忽略音频错误，不影响游戏逻辑
    }
  }

  playRuneMatch(matchCount: number, comboLevel: number = 1): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      this.synthesizer.playRuneMatch(comboLevel);
      if (matchCount >= 5) {
        this.synthesizer.playCombo(3);
      }
    } catch (e) {
      // 静默忽略
    }
  }

  playComboChain(comboCount: number): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      if (comboCount >= 3) {
        this.synthesizer.playCombo(comboCount);
      }
    } catch (e) {
      // 静默忽略
    }
  }

  playEnemyHit(damage: number, isCritical: boolean = false): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      if (isCritical || damage >= 30) {
        this.synthesizer.playCriticalHit();
      } else {
        this.synthesizer.playHit();
      }
    } catch (e) {
      // 静默忽略
    }
  }

  playPlayerHit(damage: number): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      this.synthesizer.playHit();
      if (damage >= 20) {
        this.synthesizer.playSweep({
          startFreq: 300,
          endFreq: 80,
          duration: 0.25,
          gain: 0.3,
          waveform: 'sawtooth',
        });
      }
    } catch (e) {
      // 静默忽略
    }
  }

  playVictory(): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      this.battleLoop?.stop();
      this.ambientDrone?.stop();
      this.stopHeartbeat();
      const fanfare = this.synthesizer.createVictoryFanfare();
      fanfare.connect(this.layerGains.music);
      fanfare.play();
    } catch (e) {
      // 静默忽略
    }
  }

  playDefeat(): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      this.battleLoop?.stop();
      this.ambientDrone?.stop();
      this.stopHeartbeat();
      const defeat = this.synthesizer.createDefeatMusic();
      defeat.connect(this.layerGains.music);
      defeat.play();
    } catch (e) {
      // 静默忽略
    }
  }

  playUIButton(): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      this.synthesizer.playUIButton();
    } catch (e) {
      // 静默忽略
    }
  }

  playUIClick(): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      this.synthesizer.playUIClick();
    } catch (e) {
      // 静默忽略
    }
  }

  playUIPositive(): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      this.synthesizer.playUIPositive();
    } catch (e) {
      // 静默忽略
    }
  }

  playUINegative(): void {
    if (!this.isReady()) return;
    try {
      this.resume();
      this.synthesizer.playUINegative();
    } catch (e) {
      // 静默忽略
    }
  }

  registerResource(resource: AudioResource): void {
    this.resourceRegistry.set(resource.id, resource);
  }

  async loadExternalAudio(id: string, url: string): Promise<void> {
    if (!this.audioContext) throw new Error('AudioManager not initialized');

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.externalBuffers.set(id, audioBuffer);
  }

  playExternalAudio(id: string, layer: AudioLayer = 'sfx', loop: boolean = false): void {
    if (!this.audioContext) return;

    const buffer = this.externalBuffers.get(id);
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1;

    source.connect(gainNode);
    gainNode.connect(this.layerGains[layer]);

    source.start();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  destroy(): void {
    this.menuMusic?.stop();
    this.battleLoop?.stop();
    this.ambientDrone?.stop();
    this.stopHeartbeat();
    this.fireSound?.stop();
    this.waterSound?.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const audioManager = new AudioManager();
