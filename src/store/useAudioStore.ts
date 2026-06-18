import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { audioManager, type AudioSettings, type GameScene, type SpellType } from '../audio/AudioManager';

interface AudioState {
  initialized: boolean;
  settings: AudioSettings;
  currentScene: GameScene;
  initializedPromise: Promise<void> | null;
}

interface AudioActions {
  initialize: () => Promise<void>;
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  transitionToScene: (scene: GameScene) => Promise<void>;
  setBattleIntensity: (intensity: number) => void;
  updatePlayerHp: (hpPercent: number) => void;
  playSpell: (spellType: SpellType, comboCount?: number) => void;
  playRuneMatch: (matchCount: number, comboLevel?: number) => void;
  playComboChain: (comboCount: number) => void;
  playEnemyHit: (damage: number, isCritical?: boolean) => void;
  playPlayerHit: (damage: number) => void;
  playUIButton: () => void;
  playUIClick: () => void;
  playUIPositive: () => void;
  playUINegative: () => void;
  resumeAudio: () => Promise<void>;
}

export type AudioStore = AudioState & AudioActions;

const defaultSettings: AudioSettings = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.8,
  muted: false,
};

export const useAudioStore = create<AudioStore>()(
  persist(
    (set, get) => ({
      initialized: false,
      settings: defaultSettings,
      currentScene: 'menu',
      initializedPromise: null,

      initialize: async () => {
        const state = get();
        if (state.initialized) return;
        if (state.initializedPromise) return state.initializedPromise;

        const initPromise = (async () => {
          try {
            await audioManager.init();
            audioManager.setMasterVolume(state.settings.masterVolume);
            audioManager.setMusicVolume(state.settings.musicVolume);
            audioManager.setSfxVolume(state.settings.sfxVolume);
            audioManager.setMuted(state.settings.muted);

            audioManager.setOnSettingsChange((settings) => {
              set({ settings });
            });

            set({ initialized: true, initializedPromise: null });
          } catch (error) {
            console.error('Failed to initialize audio manager:', error);
            set({ initializedPromise: null });
            throw error;
          }
        })();

        set({ initializedPromise: initPromise });
        return initPromise;
      },

      setMasterVolume: (volume: number) => {
        audioManager.setMasterVolume(volume);
        set({ settings: { ...get().settings, masterVolume: volume } });
      },

      setMusicVolume: (volume: number) => {
        audioManager.setMusicVolume(volume);
        set({ settings: { ...get().settings, musicVolume: volume } });
      },

      setSfxVolume: (volume: number) => {
        audioManager.setSfxVolume(volume);
        set({ settings: { ...get().settings, sfxVolume: volume } });
      },

      setMuted: (muted: boolean) => {
        audioManager.setMuted(muted);
        set({ settings: { ...get().settings, muted } });
      },

      toggleMuted: () => {
        const muted = !get().settings.muted;
        audioManager.setMuted(muted);
        set({ settings: { ...get().settings, muted } });
      },

      transitionToScene: async (scene: GameScene) => {
        if (!get().initialized) {
          await get().initialize();
        }
        await audioManager.transitionToScene(scene);
        set({ currentScene: scene });
      },

      setBattleIntensity: (intensity: number) => {
        audioManager.setBattleIntensity(intensity);
      },

      updatePlayerHp: (hpPercent: number) => {
        audioManager.updatePlayerHp(hpPercent);
      },

      playSpell: (spellType: SpellType, comboCount: number = 1) => {
        audioManager.playSpell(spellType, comboCount);
      },

      playRuneMatch: (matchCount: number, comboLevel: number = 1) => {
        audioManager.playRuneMatch(matchCount, comboLevel);
      },

      playComboChain: (comboCount: number) => {
        audioManager.playComboChain(comboCount);
      },

      playEnemyHit: (damage: number, isCritical: boolean = false) => {
        audioManager.playEnemyHit(damage, isCritical);
      },

      playPlayerHit: (damage: number) => {
        audioManager.playPlayerHit(damage);
      },

      playUIButton: () => {
        audioManager.playUIButton();
      },

      playUIClick: () => {
        audioManager.playUIClick();
      },

      playUIPositive: () => {
        audioManager.playUIPositive();
      },

      playUINegative: () => {
        audioManager.playUINegative();
      },

      resumeAudio: async () => {
        await audioManager.resume();
      },
    }),
    {
      name: 'audio-settings',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
