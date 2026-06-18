import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { BattleProvider } from '../contexts/BattleContext';
import { RuneGrid } from '../components/RuneGrid';
import { EnergyPool } from '../components/EnergyPool';
import { SpellButtons } from '../components/SpellButtons';
import { EnemyCard } from '../components/EnemyCard';
import { PlayerStatus } from '../components/PlayerStatus';
import { TurnInfo } from '../components/TurnInfo';
import { BattleResult } from '../components/BattleResult';
import { FloatingTexts } from '../components/FloatingTexts';
import { SpellEffect } from '../components/SpellEffect';
import { AudioPanel } from '../components/AudioPanel';
import { requestNotificationPermission } from '../utils/notifications';
import { useSceneAudio, useBattleHpAudio, useAudio } from '../audio/AudioContext';

export const BattlePage: React.FC = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const store = useGameStore();
  const { initLevel, battleStatus, screenShake, playerHp, playerMaxHp, comboCount } = store;
  const { transitionToScene, playUIButton, resumeAudio } = useAudio();

  useSceneAudio(battleStatus === 'victory' ? 'victory' : battleStatus === 'defeat' ? 'defeat' : 'battle_loop', [battleStatus]);
  useBattleHpAudio(playerHp, playerMaxHp);

  const battleStore = useMemo(() => ({
    energy: store.energy,
    maxEnergy: store.maxEnergy,
    enemy: store.enemy,
    enemyUnits: store.enemyUnits,
    selectedTargetId: store.selectedTargetId,
    isPlayerTurn: store.isPlayerTurn,
    battleStatus: store.battleStatus,
    isAnimating: store.isAnimating,
    floatingTexts: store.floatingTexts,
    spellEffect: store.spellEffect,
    comboSpellCooldowns: store.comboSpellCooldowns,
    screenShake: store.screenShake,
    playerHp: store.playerHp,
    playerMaxHp: store.playerMaxHp,
    castSpell: store.castSpell,
    castComboSpell: store.castComboSpell,
    selectTarget: store.selectTarget,
    canCastSpell: store.canCastSpell,
    canCastComboSpell: store.canCastComboSpell,
  }), [store]);

  useEffect(() => {
    if (levelId) {
      initLevel(parseInt(levelId, 10));
    }
    requestNotificationPermission();
    resumeAudio();
  }, [levelId, initLevel, resumeAudio]);

  useEffect(() => {
    if (battleStatus === 'victory') {
      transitionToScene('victory');
    } else if (battleStatus === 'defeat') {
      transitionToScene('defeat');
    }
  }, [battleStatus, transitionToScene]);

  if (battleStatus === 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-game-gold animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <BattleProvider store={battleStore}>
      <div className={`min-h-screen w-full p-4 md:p-6 ${screenShake ? 'shake' : ''}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <TurnInfo />
            <AudioPanel />
          </div>
          
          <div className="mt-6 grid lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <EnemyCard />
            </div>
            
            <div className="flex flex-col items-center">
              <RuneGrid />
            </div>
            
            <div className="space-y-6">
              <PlayerStatus />
              <EnergyPool />
              <SpellButtons />
            </div>
          </div>
        </div>
        
        <FloatingTexts />
        <SpellEffect />
        <BattleResult />
      </div>
    </BattleProvider>
  );
};
