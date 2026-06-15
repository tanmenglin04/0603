import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useWorkshopStore } from '../store/useWorkshopStore';
import { BattleProvider } from '../contexts/BattleContext';
import { RuneGrid } from '../components/RuneGrid';
import { EnergyPool } from '../components/EnergyPool';
import { SpellButtons } from '../components/SpellButtons';
import { EnemyCard } from '../components/EnemyCard';
import { PlayerStatus } from '../components/PlayerStatus';
import { TurnInfo } from '../components/TurnInfo';
import { FloatingTexts } from '../components/FloatingTexts';
import { SpellEffect } from '../components/SpellEffect';
import type { WorkshopLevel, TrialRecord, TrialAction } from '../types/workshop';
import type { WorkshopLevelConfig, Spell, ComboSpell } from '../types';
import { ArrowLeft, AlertTriangle, CheckCircle, Trophy, Save } from 'lucide-react';

export const TrialPlayPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const level = location.state?.level as WorkshopLevel | undefined;
  const isEditorTrial = location.state?.isEditor || false;

  const store = useGameStore();
  const { setTrialRecord: setEditorTrialRecord } = useWorkshopStore();
  const { initWorkshopLevel, battleStatus, screenShake, turn, playerHp, playerMaxHp, enemy, returnToMenu, selectedRunes } = store;

  const [trialRecord, setTrialRecord] = useState<TrialRecord | null>(null);
  const actionsRef = useRef<TrialAction[]>([]);
  const startTimeRef = useRef<number>(0);
  const lastTurnRef = useRef<number>(1);
  const savedRecordRef = useRef<TrialRecord | null>(null);

  const addTrialAction = useCallback((type: TrialAction['type'], data: any) => {
    const action: TrialAction = {
      turn: lastTurnRef.current,
      type,
      timestamp: Date.now(),
      data,
    };
    actionsRef.current.push(action);
  }, []);

  const handleCastSpell = useCallback((spell: Spell) => {
    if (store.battleStatus !== 'playing' || !store.isPlayerTurn) return;
    addTrialAction('spell', { spellId: spell.id, spellName: spell.name, element: spell.element });
    store.castSpell(spell);
  }, [store, addTrialAction]);

  const handleCastComboSpell = useCallback((spell: ComboSpell) => {
    if (store.battleStatus !== 'playing' || !store.isPlayerTurn) return;
    addTrialAction('combo_spell', { spellId: spell.id, spellName: spell.name, elements: spell.elements });
    store.castComboSpell(spell);
  }, [store, addTrialAction]);

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
    castSpell: handleCastSpell,
    castComboSpell: handleCastComboSpell,
    selectTarget: store.selectTarget,
    canCastSpell: store.canCastSpell,
    canCastComboSpell: store.canCastComboSpell,
  }), [store, handleCastSpell, handleCastComboSpell]);

  useEffect(() => {
    if (turn > lastTurnRef.current && battleStatus === 'playing') {
      addTrialAction('end_turn', { turn: lastTurnRef.current });
      lastTurnRef.current = turn;
    }
  }, [turn, battleStatus, addTrialAction]);

  useEffect(() => {
    if (selectedRunes.length >= 3 && store.isAnimating && battleStatus === 'playing') {
      const element = selectedRunes[0]?.element;
      const count = selectedRunes.length;
      addTrialAction('match', { element, count, runes: selectedRunes.map(r => ({ row: r.row, col: r.col, element: r.element })) });
    }
  }, [selectedRunes.length, store.isAnimating, battleStatus, selectedRunes, addTrialAction]);

  useEffect(() => {
    if (!level) return;

    const config: WorkshopLevelConfig = {
      levelId: level.id,
      name: level.name,
      enemy: {
        id: level.enemy.id,
        name: level.enemy.name,
        maxHp: level.enemy.maxHp,
        attack: level.enemy.attack,
        resistance: level.enemy.resistance,
        attackPattern: level.enemy.attackPattern,
        sprite: level.enemy.sprite,
        description: level.enemy.description,
        aiConfig: level.enemy.aiConfig,
      },
      playerMaxHp: level.playerMaxHp,
      maxEnergy: level.maxEnergy,
      gridSize: level.gridSize,
      specialTiles: level.specialTiles,
      terrain: level.terrain,
    };

    startTimeRef.current = Date.now();
    actionsRef.current = [];
    initWorkshopLevel(config);
  }, [level, initWorkshopLevel]);

  useEffect(() => {
    if (battleStatus === 'victory' || battleStatus === 'defeat') {
      const isVictory = battleStatus === 'victory';

      const record: TrialRecord = {
        completed: isVictory,
        turnsTaken: turn,
        playerHpRemaining: playerHp,
        recordedAt: Date.now(),
        actions: actionsRef.current,
      };
      setTrialRecord(record);
      savedRecordRef.current = record;

      if (isEditorTrial && isVictory) {
        setEditorTrialRecord(record);
      }
    }
  }, [battleStatus, turn, playerHp, isEditorTrial, setEditorTrialRecord]);

  if (!level) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl text-game-gold mb-2">未找到关卡数据</h2>
          <button onClick={() => navigate('/workshop')} className="game-button-primary px-6 py-2 mt-4">
            返回工坊
          </button>
        </div>
      </div>
    );
  }

  if (battleStatus === 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-game-gold animate-pulse">加载中...</div>
      </div>
    );
  }

  const reasonableTurns = Math.ceil((level.enemy.maxHp) / 15) + 5;

  return (
    <div className="min-h-screen w-full">
      <BattleProvider store={battleStore}>
        <div className={`w-full p-4 md:p-6 ${screenShake ? 'shake' : ''}`}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => {
                  returnToMenu();
                  navigate(isEditorTrial ? '/workshop/editor' : '/workshop');
                }}
                className="game-button-secondary flex items-center gap-2 px-3 py-1.5 text-sm"
              >
                <ArrowLeft size={14} />
                <span>退出试玩</span>
              </button>
              <div className="flex items-center gap-2 bg-game-gold/10 border border-game-gold/30 rounded-lg px-3 py-1.5">
                <AlertTriangle size={14} className="text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">试玩模式</span>
              </div>
            </div>

            <TurnInfo />

            <div className="mt-4 grid lg:grid-cols-3 gap-6">
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
        </div>
      </BattleProvider>

      {(battleStatus === 'victory' || battleStatus === 'defeat') && trialRecord && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="game-card p-6 max-w-md w-full animate-pop-in">
            {battleStatus === 'victory' ? (
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-game-gold font-display mb-2">试玩通关！</h2>
                <div className="bg-game-bg-dark rounded-lg p-4 mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">使用回合数</span>
                    <span className="text-game-gold font-bold">{trialRecord.turnsTaken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">剩余生命</span>
                    <span className="text-green-400 font-bold">{trialRecord.playerHpRemaining}/{playerMaxHp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">合理回合参考</span>
                    <span className="text-gray-300">{reasonableTurns} 回合</span>
                  </div>
                  <div className="border-t border-game-gold/10 pt-2 mt-2">
                    {trialRecord.turnsTaken <= reasonableTurns ? (
                      <div className="flex items-center justify-center gap-2 text-green-400">
                        <CheckCircle size={16} />
                        <span className="font-medium">回合数合理，关卡可通关</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-yellow-400">
                        <AlertTriangle size={16} />
                        <span className="font-medium">回合数偏多，建议调整难度</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4">💀</div>
                <h2 className="text-2xl font-bold text-red-400 font-display mb-2">试玩失败</h2>
                <p className="text-gray-400 mt-2">关卡可能过难，建议调整配置</p>
                <div className="bg-game-bg-dark rounded-lg p-4 mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">存活回合</span>
                    <span className="text-game-gold font-bold">{trialRecord.turnsTaken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">敌人剩余HP</span>
                    <span className="text-red-400 font-bold">{enemy?.currentHp || 0}/{level.enemy.maxHp}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6 flex-wrap">
              <button
                onClick={() => {
                  navigate(isEditorTrial ? '/workshop/editor' : '/workshop');
                }}
                className="flex-1 game-button-secondary py-2"
              >
                {isEditorTrial ? '返回编辑器' : '返回工坊'}
              </button>
              {isEditorTrial && trialRecord?.completed && (
                <button
                  onClick={() => {
                    if (trialRecord) {
                      setEditorTrialRecord(trialRecord);
                      navigate('/workshop/editor');
                    }
                  }}
                  className="flex-1 game-button-secondary py-2 flex items-center justify-center gap-2 text-green-400 border-green-400/30 hover:bg-green-500/20"
                >
                  <Save size={16} />
                  保存验证结果
                </button>
              )}
              <button
                onClick={() => {
                  if (level) {
                    const config: WorkshopLevelConfig = {
                      levelId: level.id,
                      name: level.name,
                      enemy: {
                        id: level.enemy.id,
                        name: level.enemy.name,
                        maxHp: level.enemy.maxHp,
                        attack: level.enemy.attack,
                        resistance: level.enemy.resistance,
                        attackPattern: level.enemy.attackPattern,
                        sprite: level.enemy.sprite,
                        description: level.enemy.description,
                        aiConfig: level.enemy.aiConfig,
                      },
                      playerMaxHp: level.playerMaxHp,
                      maxEnergy: level.maxEnergy,
                      gridSize: level.gridSize,
                      specialTiles: level.specialTiles,
                      terrain: level.terrain,
                    };
                    setTrialRecord(null);
                    actionsRef.current = [];
                    lastTurnRef.current = 1;
                    startTimeRef.current = Date.now();
                    initWorkshopLevel(config);
                  }
                }}
                className="flex-1 game-button-primary py-2 flex items-center justify-center gap-2"
              >
                <Trophy size={16} />
                再试一次
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
