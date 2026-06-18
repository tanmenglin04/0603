import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useAudioStore } from '../store/useAudioStore';
import type { GameScene, SpellType } from './AudioManager';

interface AudioContextValue {
  initialized: boolean;
  initialize: () => Promise<void>;
  resumeAudio: () => Promise<void>;
  transitionToScene: (scene: GameScene) => Promise<void>;
  playSpell: (spellType: SpellType, comboCount?: number) => void;
  playRuneMatch: (matchCount: number, comboLevel?: number) => void;
  playComboChain: (comboCount: number) => void;
  playEnemyHit: (damage: number, isCritical?: boolean) => void;
  playPlayerHit: (damage: number) => void;
  playUIButton: () => void;
  playUIClick: () => void;
  playUIPositive: () => void;
  playUINegative: () => void;
  setBattleIntensity: (intensity: number) => void;
  updatePlayerHp: (hpPercent: number) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    initialized,
    initialize,
    transitionToScene,
    playSpell,
    playRuneMatch,
    playComboChain,
    playEnemyHit,
    playPlayerHit,
    playUIButton,
    playUIClick,
    playUIPositive,
    playUINegative,
    setBattleIntensity,
    updatePlayerHp,
    resumeAudio,
  } = useAudioStore();

  useEffect(() => {
    const handleFirstInteraction = async () => {
      if (!initialized) {
        try {
          await initialize();
          await resumeAudio();
          window.removeEventListener('click', handleFirstInteraction);
          window.removeEventListener('keydown', handleFirstInteraction);
          window.removeEventListener('touchstart', handleFirstInteraction);
        } catch (e) {
          console.debug('Audio init failed on first interaction, will retry later');
        }
      }
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [initialized, initialize, resumeAudio]);

  const value: AudioContextValue = {
    initialized,
    initialize,
    resumeAudio,
    transitionToScene,
    playSpell,
    playRuneMatch,
    playComboChain,
    playEnemyHit,
    playPlayerHit,
    playUIButton,
    playUIClick,
    playUIPositive,
    playUINegative,
    setBattleIntensity,
    updatePlayerHp,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudio = (): AudioContextValue => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const useSceneAudio = (scene: GameScene, deps: React.DependencyList = []) => {
  const { transitionToScene, initialized } = useAudio();

  useEffect(() => {
    if (initialized) {
      transitionToScene(scene);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, initialized, ...deps]);
};

export const useBattleHpAudio = (playerHp: number, playerMaxHp: number) => {
  const { updatePlayerHp } = useAudio();

  useEffect(() => {
    if (playerMaxHp > 0) {
      updatePlayerHp(playerHp / playerMaxHp);
    }
  }, [playerHp, playerMaxHp, updatePlayerHp]);
};

export const useSpellAudio = () => {
  const { playSpell, playEnemyHit, playUIPositive } = useAudio();

  return useCallback(
    (spellId: string, damage?: number, comboCount: number = 1) => {
      let spellType: SpellType = 'fireball';
      switch (spellId) {
        case 'fireball':
          spellType = 'fireball';
          break;
        case 'thunder-strike':
          spellType = 'thunder_strike';
          break;
        case 'water-heal':
          spellType = 'heal';
          break;
        case 'vine-whip':
          spellType = 'vine_whip';
          break;
        default:
          if (spellId.includes('+') || spellId.includes('combo')) {
            spellType = 'combo';
          }
      }
      playSpell(spellType, comboCount);
      if (damage && damage > 0) {
        setTimeout(() => playEnemyHit(damage, damage >= 30), 200);
      }
      if (spellType === 'heal') {
        setTimeout(() => playUIPositive(), 300);
      }
    },
    [playSpell, playEnemyHit, playUIPositive]
  );
};

export const useMatchAudio = () => {
  const { playRuneMatch, playComboChain } = useAudio();

  return useCallback(
    (matchCount: number, comboLevel: number = 1, chainComboCount?: number) => {
      playRuneMatch(matchCount, comboLevel);
      if (chainComboCount && chainComboCount >= 3) {
        setTimeout(() => playComboChain(chainComboCount), 100);
      }
    },
    [playRuneMatch, playComboChain]
  );
};
