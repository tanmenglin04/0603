import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useArenaStore } from '../store/useArenaStore';
import { SPELLS, GRID_SIZE, ELEMENT_COLORS, ELEMENT_ICONS, RANK_CONFIGS, getRankByPoints } from '../types';
import type {
  ReplayAction,
  BattleReplayData,
  ElementType,
  Rune,
} from '../types';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  Clock,
  Heart,
  Swords,
  Zap,
  Flame,
  Circle,
} from 'lucide-react';

const getRankConfig = (tier: string) =>
  RANK_CONFIGS.find((r) => r.tier === tier) || RANK_CONFIGS[0];

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const elements: ElementType[] = ['fire', 'water', 'grass', 'thunder'];

const generateMockGrid = (highlightedCells?: { row: number; col: number }[], actionElement?: ElementType): Rune[][] => {
  const grid: Rune[][] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    grid[row] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      const isHighlighted = highlightedCells?.some((c) => c.row === row && c.col === col);
      grid[row][col] = {
        id: `mock_${row}_${col}`,
        element: isHighlighted && actionElement ? actionElement : elements[Math.floor(Math.random() * elements.length)],
        row,
        col,
        isSelected: false,
        isMatched: false,
        isNew: false,
        tileType: 'normal',
        frozenHitCount: 0,
        doubleEnergyTurnsLeft: 0,
      };
    }
  }
  return grid;
};

const getHighlightedCells = (action: ReplayAction | null): { row: number; col: number }[] => {
  if (!action || action.actionType !== 'match_runes') return [];
  const count = action.payload?.matchLength || 4;
  const cells: { row: number; col: number }[] = [];
  let row = Math.floor(Math.random() * (GRID_SIZE - 1));
  let col = Math.floor(Math.random() * (GRID_SIZE - 1));
  for (let i = 0; i < count && i < 8; i++) {
    cells.push({ row, col });
    if (i % 2 === 0 && col < GRID_SIZE - 1) col++;
    else if (row < GRID_SIZE - 1) row++;
  }
  return cells;
};

export const BattleReplayPage: React.FC = () => {
  const navigate = useNavigate();
  const { battleId = '' } = useParams<{ battleId: string }>();
  const {
    activeReplay,
    startReplay,
    battleHistory,
    currentProfile,
    resetCurrentBattle,
  } = useArenaStore();

  const [replay, setReplay] = useState<BattleReplayData | null>(null);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [attackerHp, setAttackerHp] = useState(0);
  const [defenderHp, setDefenderHp] = useState(0);
  const [grid, setGrid] = useState<Rune[][]>(() => generateMockGrid());
  const [attackerEnergy, setAttackerEnergy] = useState({ fire: 0, water: 0, grass: 0, thunder: 0 });

  const playIntervalRef = useRef<number | null>(null);
  const battleRecord = useMemo(
    () => battleHistory.find((b) => b.battleId === battleId),
    [battleHistory, battleId]
  );

  useEffect(() => {
    const loaded = startReplay(battleId);
    if (loaded) {
      setReplay(loaded);
      setAttackerHp(loaded.initialState.attackerHp);
      setDefenderHp(loaded.initialState.defenderHp);
      setCurrentActionIndex(0);
      setGrid(generateMockGrid());
      setAttackerEnergy({ fire: 0, water: 0, grass: 0, thunder: 0 });
    }
  }, [battleId, startReplay]);

  useEffect(() => {
    if (activeReplay && !replay) {
      setReplay(activeReplay);
      setAttackerHp(activeReplay.initialState.attackerHp);
      setDefenderHp(activeReplay.initialState.defenderHp);
    }
  }, [activeReplay, replay]);

  const currentAction: ReplayAction | null = useMemo(() => {
    if (!replay || !replay.actions.length) return null;
    if (currentActionIndex < 0) return null;
    return replay.actions[Math.min(currentActionIndex, replay.actions.length - 1)];
  }, [replay, currentActionIndex]);

  const actionsByTurn = useMemo(() => {
    if (!replay) return new Map<number, ReplayAction[]>();
    const map = new Map<number, ReplayAction[]>();
    replay.actions.forEach((action) => {
      const turn = action.turn;
      if (!map.has(turn)) map.set(turn, []);
      map.get(turn)!.push(action);
    });
    return map;
  }, [replay]);

  const totalTurns = useMemo(() => {
    if (!replay) return 0;
    return Math.max(...replay.actions.map((a) => a.turn), 0);
  }, [replay]);

  const currentTurn = currentAction?.turn ?? 0;

  useEffect(() => {
    if (currentAction) {
      setAttackerHp(currentAction.hpAfter.attacker);
      setDefenderHp(currentAction.hpAfter.defender);
      setAttackerEnergy(currentAction.energyAfter);
      const highlighted = getHighlightedCells(currentAction);
      const actionElement =
        currentAction.actionType === 'match_runes'
          ? (currentAction.payload?.element as ElementType)
          : currentAction.actionType === 'cast_spell'
          ? SPELLS.find((s) => s.id === currentAction.payload?.spellId)?.element
          : undefined;
      setGrid(generateMockGrid(highlighted, actionElement));
    }
  }, [currentAction]);

  useEffect(() => {
    if (isPlaying && replay) {
      const baseInterval = 2000;
      const interval = baseInterval / playbackSpeed;
      playIntervalRef.current = window.setInterval(() => {
        setCurrentActionIndex((prev) => {
          if (!replay) return prev;
          if (prev >= replay.actions.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, replay]);

  const handleTogglePlay = () => {
    if (!replay) return;
    if (currentActionIndex >= replay.actions.length - 1) {
      setCurrentActionIndex(0);
    }
    setIsPlaying((p) => !p);
  };

  const handlePrevAction = () => {
    setIsPlaying(false);
    setCurrentActionIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextAction = () => {
    if (!replay) return;
    setIsPlaying(false);
    setCurrentActionIndex((prev) => Math.min(replay.actions.length - 1, prev + 1));
  };

  const handlePrevTurn = () => {
    if (!replay) return;
    setIsPlaying(false);
    const targetTurn = Math.max(0, currentTurn - 1);
    const index = replay.actions.findIndex((a) => a.turn >= targetTurn);
    if (index >= 0) setCurrentActionIndex(index);
  };

  const handleNextTurn = () => {
    if (!replay) return;
    setIsPlaying(false);
    const targetTurn = currentTurn + 1;
    const index = replay.actions.findIndex((a) => a.turn >= targetTurn);
    setCurrentActionIndex(index >= 0 ? index : replay.actions.length - 1);
  };

  const handleSpeedUp = () => {
    setPlaybackSpeed((s) => Math.min(4, s + 0.5));
  };

  const handleSlowDown = () => {
    setPlaybackSpeed((s) => Math.max(0.5, s - 0.5));
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replay) return;
    setIsPlaying(false);
    const value = parseFloat(e.target.value);
    const index = Math.floor((value / 100) * (replay.actions.length - 1));
    setCurrentActionIndex(Math.max(0, Math.min(replay.actions.length - 1, index)));
  };

  const handleSelectAction = (index: number) => {
    setIsPlaying(false);
    setCurrentActionIndex(index);
  };

  const handleReturnHome = () => {
    resetCurrentBattle();
    navigate('/arena');
  };

  if (!replay) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-game-bg">
        <div className="text-center">
          <div className="text-2xl text-game-gold animate-pulse mb-4">加载录像中...</div>
          <button
            onClick={handleReturnHome}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-game-card border border-game-gold/30 text-gray-300 hover:text-game-gold hover:border-game-gold/60 transition-all mx-auto"
          >
            <ArrowLeft size={20} />
            <span>返回竞技场</span>
          </button>
        </div>
      </div>
    );
  }

  const attackerMaxHp = replay.initialState.attackerMaxHp;
  const defenderMaxHp = replay.initialState.defenderMaxHp;
  const attackerHpPct = (attackerHp / attackerMaxHp) * 100;
  const defenderHpPct = (defenderHp / defenderMaxHp) * 100;

  const getHpBarColor = (pct: number) => {
    if (pct > 60) return 'bg-green-500';
    if (pct > 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const progressPercent = replay.actions.length > 1
    ? (currentActionIndex / (replay.actions.length - 1)) * 100
    : 0;

  const attackerRank = currentProfile ? getRankByPoints(currentProfile.rankPoints) : RANK_CONFIGS[0];
  const defenderRank = RANK_CONFIGS[3];

  const highlightedCells = getHighlightedCells(currentAction);
  const actionElement =
    currentAction?.actionType === 'match_runes'
      ? (currentAction.payload?.element as ElementType)
      : undefined;

  return (
    <div className="min-h-screen w-full overflow-auto p-4 md:p-6 bg-game-bg">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleReturnHome}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-game-card border border-game-gold/30 text-gray-300 hover:text-game-gold hover:border-game-gold/60 transition-all"
          >
            <ArrowLeft size={20} />
            <span>返回竞技场</span>
          </button>
          <div className="flex items-center gap-2 text-game-gold font-display text-xl md:text-2xl">
            <Swords size={28} />
            <span>对战录像回放</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock size={16} />
            <span>{battleRecord ? formatDuration(battleRecord.durationMs) : '--:--'}</span>
          </div>
        </div>

        <div className="game-card p-4 md:p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <div
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shrink-0"
                style={{
                  border: `4px solid ${attackerRank.color}`,
                  background: `${attackerRank.color}20`,
                  boxShadow: `0 0 20px ${attackerRank.color}40`,
                }}
              >
                <span className="text-3xl md:text-4xl">{currentProfile?.avatar || '🧙'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-white text-lg truncate">
                    {battleRecord?.attackerName || currentProfile?.playerName || '进攻方'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs border border-blue-500/40 shrink-0">
                    进攻方
                  </span>
                </div>
                <div
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-2"
                  style={{ background: `${attackerRank.color}20`, border: `1px solid ${attackerRank.color}60` }}
                >
                  <span>{attackerRank.icon}</span>
                  <span className="text-sm font-bold" style={{ color: attackerRank.color }}>
                    {attackerRank.name}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1 text-gray-300">
                      <Heart size={12} className="text-red-400" />
                      HP
                    </span>
                    <span className="font-bold text-white">
                      {attackerHp}/{attackerMaxHp}
                    </span>
                  </div>
                  <div className="health-bar h-3">
                    <div
                      className={`health-bar-fill ${getHpBarColor(attackerHpPct)} transition-all duration-500`}
                      style={{ width: `${attackerHpPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-row-reverse md:flex-row">
              <div
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shrink-0"
                style={{
                  border: `4px solid ${defenderRank.color}`,
                  background: `${defenderRank.color}20`,
                  boxShadow: `0 0 20px ${defenderRank.color}40`,
                }}
              >
                <span className="text-3xl md:text-4xl">🤖</span>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center gap-2 mb-1 justify-end">
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs border border-red-500/40 shrink-0">
                    防守方
                  </span>
                  <h3 className="font-bold text-white text-lg truncate">
                    {battleRecord?.defenderName || 'AI防守者'}
                  </h3>
                </div>
                <div
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-2"
                  style={{ background: `${defenderRank.color}20`, border: `1px solid ${defenderRank.color}60` }}
                >
                  <span>{defenderRank.icon}</span>
                  <span className="text-sm font-bold" style={{ color: defenderRank.color }}>
                    {defenderRank.name}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1 text-gray-300">
                      <Heart size={12} className="text-red-400" />
                      HP
                    </span>
                    <span className="font-bold text-white">
                      {defenderHp}/{defenderMaxHp}
                    </span>
                  </div>
                  <div className="health-bar h-3">
                    <div
                      className={`health-bar-fill ${getHpBarColor(defenderHpPct)} transition-all duration-500`}
                      style={{ width: `${defenderHpPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 my-6">
            <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-blue-500" />
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-black text-game-gold font-display">
                VS
              </div>
              <div className="text-sm text-gray-400 mt-1">
                回合 <span className="text-game-gold font-bold">{currentTurn}</span>
                <span className="mx-2">/</span>
                共 <span className="text-game-gold font-bold">{totalTurns}</span> 回合
              </div>
              {currentAction && (
                <div className="text-xs text-gray-500 mt-1">
                  {formatTimestamp(currentAction.timestamp)}
                </div>
              )}
            </div>
            <div className="flex-1 h-0.5 bg-gradient-to-l from-transparent via-red-500/50 to-red-500" />
          </div>

          <div className="grid grid-cols-4 gap-2 md:gap-4 mb-4">
            {elements.map((el) => (
              <div key={el} className="bg-game-bg-dark rounded-lg p-2 md:p-3 text-center">
                <div className="text-xl md:text-2xl mb-1">{ELEMENT_ICONS[el]}</div>
                <div className="text-xs md:text-sm font-bold" style={{ color: ELEMENT_COLORS[el] }}>
                  {attackerEnergy[el]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="game-card p-4 md:p-6 mb-6">
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">
                进度 {currentActionIndex + 1} / {replay.actions.length}
              </span>
              <span className="text-game-gold font-bold flex items-center gap-1">
                <Zap size={14} />
                {playbackSpeed}x
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-0 h-2 bg-game-bg-dark rounded-full top-1/2 -translate-y-1/2" />
              <div
                className="absolute inset-y-0 left-0 h-2 bg-gradient-to-r from-game-gold to-game-gold-light rounded-full top-1/2 -translate-y-1/2 transition-all"
                style={{ width: `${progressPercent}%`, boxShadow: '0 0 10px rgba(212, 175, 55, 0.5)' }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progressPercent}
                onChange={handleProgressChange}
                className="relative w-full h-4 appearance-none bg-transparent cursor-pointer z-10"
                style={{
                  WebkitAppearance: 'none',
                }}
              />
              <style>{`
                input[type="range"]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: #d4af37;
                  border: 2px solid #fff;
                  cursor: pointer;
                  box-shadow: 0 0 10px rgba(212, 175, 55, 0.8);
                }
                input[type="range"]::-moz-range-thumb {
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: #d4af37;
                  border: 2px solid #fff;
                  cursor: pointer;
                  box-shadow: 0 0 10px rgba(212, 175, 55, 0.8);
                }
              `}</style>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
            <button
              onClick={handleSlowDown}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="减速"
            >
              <Rewind size={20} />
            </button>
            <button
              onClick={handlePrevTurn}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="上一回合"
            >
              <SkipBack size={20} />
            </button>
            <button
              onClick={handlePrevAction}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="上一步"
            >
              <Circle size={18} />
            </button>
            <button
              onClick={handleTogglePlay}
              className="p-3 md:p-4 rounded-xl bg-gradient-to-br from-game-gold to-game-gold-light text-game-bg-dark hover:scale-105 transition-transform shadow-lg shadow-game-gold/30"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              onClick={handleNextAction}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="下一步"
            >
              <Circle size={18} />
            </button>
            <button
              onClick={handleNextTurn}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="下一回合"
            >
              <SkipForward size={20} />
            </button>
            <button
              onClick={handleSpeedUp}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="加速"
            >
              <FastForward size={20} />
            </button>
          </div>

          {currentAction && (
            <div className="mt-4 p-3 md:p-4 rounded-xl bg-gradient-to-r from-game-gold/10 to-transparent border border-game-gold/20">
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <div className={`px-2 py-1 rounded-md text-xs font-bold shrink-0 ${
                  currentAction.side === 'attacker'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}>
                  {currentAction.side === 'attacker' ? '进攻方' : '防守方'}
                </div>
                <div className={`px-2 py-1 rounded-md text-xs font-bold shrink-0 ${
                  currentAction.actionType === 'match_runes'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                    : currentAction.actionType === 'cast_spell' || currentAction.actionType === 'cast_combo_spell'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
                }`}>
                  {currentAction.actionType === 'match_runes' && '消除符文'}
                  {currentAction.actionType === 'cast_spell' && '施放法术'}
                  {currentAction.actionType === 'cast_combo_spell' && '连携技'}
                  {currentAction.actionType === 'end_turn' && '结束回合'}
                </div>
                <span className="text-white text-sm md:text-base flex-1 min-w-0 truncate">
                  {currentAction.description}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="game-card p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flame size={22} className="text-game-gold" />
              <h3 className="text-lg font-bold text-game-gold font-display">动作列表</h3>
            </div>

            <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
              {Array.from(actionsByTurn.entries()).sort(([a], [b]) => a - b).map(([turn, actions]) => (
                <div key={turn} className="space-y-2">
                  <div className="flex items-center gap-2 sticky top-0 bg-game-card py-2 z-10">
                    <div className="w-8 h-8 rounded-full bg-game-gold/20 flex items-center justify-center border border-game-gold/40">
                      <span className="text-game-gold font-bold text-sm">{turn || 'S'}</span>
                    </div>
                    <span className="text-sm text-gray-400">
                      {turn === 0 ? '开始' : `第 ${turn} 回合`}
                    </span>
                  </div>
                  <div className="space-y-1.5 pl-10">
                    {actions.map((action, idx) => {
                      const actionGlobalIndex = replay.actions.indexOf(action);
                      const isActive = actionGlobalIndex === currentActionIndex;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectAction(actionGlobalIndex)}
                          className={`w-full text-left p-2 md:p-3 rounded-lg transition-all ${
                            isActive
                              ? 'bg-game-gold/20 border border-game-gold/60 shadow-lg shadow-game-gold/10'
                              : 'bg-game-bg-dark/50 border border-transparent hover:border-game-gold/30 hover:bg-game-bg-dark'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              action.side === 'attacker'
                                ? 'bg-blue-500/30 text-blue-300'
                                : 'bg-red-500/30 text-red-300'
                            }`}>
                              {action.side === 'attacker' ? '攻' : '防'}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              action.actionType === 'match_runes'
                                ? 'bg-green-500/30 text-green-300'
                                : action.actionType === 'cast_spell' || action.actionType === 'cast_combo_spell'
                                ? 'bg-purple-500/30 text-purple-300'
                                : 'bg-gray-500/30 text-gray-300'
                            }`}>
                              {action.actionType === 'match_runes' ? '消' :
                               action.actionType === 'cast_spell' ? '法' :
                               action.actionType === 'cast_combo_spell' ? '连' : '终'}
                            </span>
                            <span className="text-xs md:text-sm text-gray-200 flex-1 min-w-0 truncate">
                              {action.description}
                            </span>
                            <span className="text-[10px] text-gray-500 shrink-0">
                              {formatTimestamp(action.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] md:text-xs text-gray-500 pl-10">
                            <span className="flex items-center gap-0.5">
                              <Heart size={10} className="text-blue-400" />
                              {action.hpAfter.attacker}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Heart size={10} className="text-red-400" />
                              {action.hpAfter.defender}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="game-card p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={22} className="text-game-gold" />
              <h3 className="text-lg font-bold text-game-gold font-display">模拟棋盘</h3>
              {currentAction && (
                <span className="ml-auto text-xs text-gray-400">
                  {currentAction.side === 'attacker' ? '进攻方回合' : '防守方回合'}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center">
              <div
                className="relative p-3 md:p-4 bg-game-bg-dark rounded-2xl border-2 border-game-gold/30 shadow-2xl"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${GRID_SIZE}, 48px)`,
                  gridTemplateRows: `repeat(${GRID_SIZE}, 48px)`,
                  gap: '6px',
                }}
              >
                {grid.map((row) =>
                  row.map((rune) => {
                    const isHighlighted = highlightedCells.some(
                      (c) => c.row === rune.row && c.col === rune.col
                    );
                    return (
                      <div
                        key={rune.id}
                        className={`relative rounded-xl flex items-center justify-center transition-all duration-300 ${
                          isHighlighted ? 'scale-110 z-10' : ''
                        }`}
                        style={{
                          width: 48,
                          height: 48,
                          background: isHighlighted
                            ? `linear-gradient(135deg, ${ELEMENT_COLORS[rune.element]}40, ${ELEMENT_COLORS[rune.element]}20)`
                            : 'linear-gradient(135deg, #2a2a3e 0%, #1a1a2e 100%)',
                          border: isHighlighted
                            ? `2px solid ${ELEMENT_COLORS[rune.element]}`
                            : '1px solid rgba(255,255,255,0.05)',
                          boxShadow: isHighlighted
                            ? `0 0 20px ${ELEMENT_COLORS[rune.element]}80, inset 0 0 15px ${ELEMENT_COLORS[rune.element]}30`
                            : 'none',
                        }}
                      >
                        <span
                          className={`text-2xl md:text-3xl transition-transform ${
                            isHighlighted ? 'animate-pulse scale-110' : ''
                          }`}
                        >
                          {ELEMENT_ICONS[rune.element]}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {currentAction?.actionType === 'match_runes' && actionElement && (
                <div className="mt-4 text-center">
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                    style={{
                      background: `${ELEMENT_COLORS[actionElement]}20`,
                      border: `1px solid ${ELEMENT_COLORS[actionElement]}60`,
                    }}
                  >
                    <span className="text-2xl">{ELEMENT_ICONS[actionElement]}</span>
                    <span className="font-bold" style={{ color: ELEMENT_COLORS[actionElement] }}>
                      消除 {currentAction.payload?.matchLength} 个符文
                    </span>
                    <span className="text-gray-400">
                      造成 <span className="text-white font-bold">{currentAction.payload?.damage || 0}</span> 伤害
                    </span>
                  </div>
                </div>
              )}

              {(currentAction?.actionType === 'cast_spell' || currentAction?.actionType === 'cast_combo_spell') && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/60">
                    <span className="text-2xl">✨</span>
                    <span className="font-bold text-purple-300">
                      {currentAction.payload?.spellName || '法术'}
                    </span>
                    {currentAction.payload?.damage > 0 && (
                      <span className="text-gray-400">
                        伤害: <span className="text-white font-bold">{currentAction.payload.damage}</span>
                      </span>
                    )}
                    {currentAction.payload?.heal > 0 && (
                      <span className="text-gray-400">
                        治疗: <span className="text-green-400 font-bold">+{currentAction.payload.heal}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {currentAction?.actionType === 'end_turn' && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-500/20 border border-gray-500/60">
                    <SkipForward size={20} className="text-gray-400" />
                    <span className="font-bold text-gray-300">回合结束</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
