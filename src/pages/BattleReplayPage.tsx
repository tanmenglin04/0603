import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useArenaStore } from '../store/useArenaStore';
import { useGameStore } from '../store/useGameStore';
import {
  BattleReplayEngine,
} from '../utils/battleReplayEngine';
import {
  loadReplay,
} from '../utils/replayStorage';
import { SPELLS, GRID_SIZE, ELEMENT_COLORS, ELEMENT_ICONS, HIGHLIGHT_TYPE_META } from '../types';
import type {
  ReplayAction,
  BattleReplayData,
  ElementType,
  Rune,
  BattleReplayV2,
  ReplayPlaybackState,
  ShareCardData,
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
  Star,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
} from 'lucide-react';

const elements: ElementType[] = ['fire', 'water', 'grass', 'thunder'];

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatTimestamp = (ts: number): string => {
  const date = new Date(ts);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getHpBarColor = (pct: number) => {
  if (pct > 60) return 'bg-green-500';
  if (pct > 30) return 'bg-yellow-500';
  return 'bg-red-500';
};

const speedOptions: (1 | 2 | 4)[] = [1, 2, 4];

const generateMockGridForV2 = (state: ReplayPlaybackState | null): Rune[][] => {
  const grid: Rune[][] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    grid[row] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      const isHighlighted = state?.highlightedCells?.some(
        (c) => c.row === row && c.col === col
      );
      const el: ElementType =
        isHighlighted && state.currentEvent?.type === 'match_runes'
          ? (state.highlightedCells[0]?.element as ElementType) || 'fire'
          : elements[(row * 3 + col * 7) % elements.length];
      grid[row][col] = {
        id: `r_${row}_${col}_${state?.currentEventIndex || 0}`,
        element: el,
        row,
        col,
        isSelected: isHighlighted,
        isMatched: isHighlighted,
        isNew: false,
        tileType: 'normal',
        frozenHitCount: 0,
        doubleEnergyTurnsLeft: 0,
      };
    }
  }
  return grid;
};

export const BattleReplayPage: React.FC = () => {
  const navigate = useNavigate();
  const { battleId = '' } = useParams<{ battleId: string }>();
  const location = useLocation();
  const {
    activeReplay,
    startReplay,
    battleHistory,
    currentProfile,
    resetCurrentBattle,
  } = useArenaStore();

  const useV2Engine = useRef<boolean>(false);
  const v2EngineRef = useRef<BattleReplayEngine | null>(null);
  const [v2Replay, setV2Replay] = useState<BattleReplayV2 | null>(null);
  const [playbackState, setPlaybackState] = useState<ReplayPlaybackState | null>(null);
  const [selectedCard, setSelectedCard] = useState<ShareCardData | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);

  // Legacy v1 state
  const [replay, setReplay] = useState<BattleReplayData | null>(null);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [isPlayingV1, setIsPlayingV1] = useState(false);
  const [playbackSpeedV1, setPlaybackSpeedV1] = useState(1);
  const [attackerHp, setAttackerHp] = useState(0);
  const [defenderHp, setDefenderHp] = useState(0);
  const [grid, setGrid] = useState<Rune[][]>(() => generateMockGridForV2(null));
  const [attackerEnergy, setAttackerEnergy] = useState({ fire: 0, water: 0, grass: 0, thunder: 0 });

  const playIntervalRef = useRef<number | null>(null);
  const battleRecord = useMemo(
    () => battleHistory.find((b) => b.battleId === battleId),
    [battleHistory, battleId]
  );

  // Try to load V2 replay from game store or from storage
  useEffect(() => {
    const state = location.state as { fromGameStore?: boolean; battleId?: string } | null;
    const lastReplay = useGameStore.getState().lastReplayData;

    if (lastReplay && (state?.fromGameStore || !battleId)) {
      useV2Engine.current = true;
      setV2Replay(lastReplay);
      try {
        const engine = new BattleReplayEngine(lastReplay);
        v2EngineRef.current = engine;
        setPlaybackState(engine.getPlaybackState());
        engine.onStateChange((s) => setPlaybackState(s));
      } catch (e) {
        console.error('Failed to create V2 engine:', e);
      }
      return;
    }

    if (battleId) {
      const loaded = loadReplay(battleId);
      if (loaded) {
        useV2Engine.current = true;
        setV2Replay(loaded);
        try {
          const engine = new BattleReplayEngine(loaded);
          v2EngineRef.current = engine;
          setPlaybackState(engine.getPlaybackState());
          engine.onStateChange((s) => setPlaybackState(s));
        } catch (e) {
          console.error('Failed to create V2 engine:', e);
        }
        return;
      }

      // Fallback to arena v1 replay
      const arenaLoaded = startReplay(battleId);
      if (arenaLoaded) {
        setReplay(arenaLoaded);
        setAttackerHp(arenaLoaded.initialState.attackerHp);
        setDefenderHp(arenaLoaded.initialState.defenderHp);
        setCurrentActionIndex(0);
        setGrid(generateMockGridForV2(null));
        setAttackerEnergy({ fire: 0, water: 0, grass: 0, thunder: 0 });
      }
    }
  }, [battleId, startReplay, location.state]);

  useEffect(() => {
    if (activeReplay && !replay && !v2Replay) {
      setReplay(activeReplay);
      setAttackerHp(activeReplay.initialState.attackerHp);
      setDefenderHp(activeReplay.initialState.defenderHp);
    }
  }, [activeReplay, replay, v2Replay]);

  // ============== V2 ENGINE HANDLERS ==============
  const v2IsPlaying = playbackState?.isPlaying || false;
  const v2Speed = playbackState?.playbackSpeed || 1;
  const v2Progress = v2EngineRef.current?.getProgress() || 0;
  const v2EventCount = v2Replay?.events.length || 0;
  const v2EventIndex = playbackState?.currentEventIndex || 0;
  const v2Turn = playbackState?.currentTurn || 0;
  const v2TotalTurns = v2Replay?.hpTimeline?.turnMarkers?.length || 0;
  const v2Highlights = v2Replay?.highlights || [];

  const handleTogglePlay = useCallback(() => {
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.togglePlay();
      return;
    }
    if (!replay) return;
    if (currentActionIndex >= replay.actions.length - 1) {
      setCurrentActionIndex(0);
    }
    setIsPlayingV1((p) => !p);
  }, [replay, currentActionIndex]);

  const handleSetSpeed = useCallback((s: 1 | 2 | 4) => {
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.setSpeed(s);
    } else {
      setPlaybackSpeedV1(s);
    }
  }, []);

  const handleStepBack = useCallback(() => {
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.pause();
      v2EngineRef.current.stepBackward();
      return;
    }
    setIsPlayingV1(false);
    setCurrentActionIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleStepForward = useCallback(() => {
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.pause();
      v2EngineRef.current.stepForward();
      return;
    }
    if (!replay) return;
    setIsPlayingV1(false);
    setCurrentActionIndex((prev) => Math.min(replay.actions.length - 1, prev + 1));
  }, [replay]);

  const handlePrevTurn = useCallback(() => {
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.pause();
      v2EngineRef.current.jumpToPrevTurn();
      return;
    }
    if (!replay) return;
    setIsPlayingV1(false);
    const currentTurn = (currentAction ? currentAction.turn : 0);
    const targetTurn = Math.max(0, currentTurn - 1);
    const index = replay.actions.findIndex((a) => a.turn >= targetTurn);
    if (index >= 0) setCurrentActionIndex(index);
  }, [replay, currentAction]);

  const handleNextTurn = useCallback(() => {
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.pause();
      v2EngineRef.current.jumpToNextTurn();
      return;
    }
    if (!replay) return;
    setIsPlayingV1(false);
    const currentTurn = (currentAction ? currentAction.turn : 0) + 1;
    const index = replay.actions.findIndex((a) => a.turn >= currentTurn);
    setCurrentActionIndex(index >= 0 ? index : replay.actions.length - 1);
  }, [replay, currentAction]);

  const handleJumpToStart = useCallback(() => {
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.pause();
      v2EngineRef.current.jumpToStart();
    } else {
      setIsPlayingV1(false);
      setCurrentActionIndex(0);
    }
  }, []);

  const handleJumpToEnd = useCallback(() => {
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.pause();
      v2EngineRef.current.jumpToEnd();
    } else if (replay) {
      setIsPlayingV1(false);
      setCurrentActionIndex(replay.actions.length - 1);
    }
  }, [replay]);

  const handleJumpToHighlight = useCallback((idx: number) => {
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.pause();
      const hls = v2EngineRef.current.getHighlights();
      if (idx < hls.length) {
        v2EngineRef.current.navigate({ type: 'highlightIndex', index: idx });
      }
    }
  }, []);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (useV2Engine.current && v2EngineRef.current) {
      v2EngineRef.current.pause();
      v2EngineRef.current.setEventProgress(value / 100);
      return;
    }
    if (!replay) return;
    setIsPlayingV1(false);
    const index = Math.floor((value / 100) * (replay.actions.length - 1));
    setCurrentActionIndex(Math.max(0, Math.min(replay.actions.length - 1, index)));
  };

  // Legacy V1 effect
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

  const totalTurnsV1 = useMemo(() => {
    if (!replay) return 0;
    return Math.max(...replay.actions.map((a) => a.turn), 0);
  }, [replay]);

  useEffect(() => {
    if (currentAction) {
      setAttackerHp(currentAction.hpAfter.attacker);
      setDefenderHp(currentAction.hpAfter.defender);
      setAttackerEnergy(currentAction.energyAfter);
    }
  }, [currentAction]);

  useEffect(() => {
    if (isPlayingV1 && replay) {
      const baseInterval = 2000;
      const interval = baseInterval / playbackSpeedV1;
      playIntervalRef.current = window.setInterval(() => {
        setCurrentActionIndex((prev) => {
          if (!replay) return prev;
          if (prev >= replay.actions.length - 1) {
            setIsPlayingV1(false);
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
  }, [isPlayingV1, playbackSpeedV1, replay]);

  // === Update mock grid for both modes ===
  useEffect(() => {
    if (useV2Engine.current && playbackState) {
      setGrid(generateMockGridForV2(playbackState));
    }
  }, [playbackState]);

  const isUsingV2 = useV2Engine.current && !!v2Replay;

  const playerMaxHp = isUsingV2 ? (v2Replay?.playerMaxHp || 100) : replay?.initialState.attackerMaxHp || 100;
  const enemyMaxHp = isUsingV2 ? (v2Replay?.enemyMaxHp || 100) : replay?.initialState.defenderMaxHp || 100;
  const playerHp = isUsingV2 ? (playbackState?.playerHp ?? playerMaxHp) : attackerHp;
  const enemyHp = isUsingV2 ? (playbackState?.enemyHp ?? enemyMaxHp) : defenderHp;
  const energy = isUsingV2 ? (playbackState?.energy || { fire: 0, water: 0, grass: 0, thunder: 0 }) : attackerEnergy;

  const playerHpPct = Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100));
  const enemyHpPct = Math.max(0, Math.min(100, (enemyHp / enemyMaxHp) * 100));
  const currentTurnDisp = isUsingV2 ? v2Turn : (currentAction?.turn ?? 0);
  const totalTurnsDisp = isUsingV2 ? v2TotalTurns : totalTurnsV1;
  const progressPercent = isUsingV2
    ? v2Progress * 100
    : replay && replay.actions.length > 1
    ? (currentActionIndex / (replay.actions.length - 1)) * 100
    : 0;
  const currentEventCount = isUsingV2 ? v2EventCount : (replay?.actions.length || 0);
  const currentEventIdx = isUsingV2 ? v2EventIndex : currentActionIndex;

  // === HP Curve for V2 ===
  const hpCurve = useMemo(() => {
    if (!isUsingV2 || !v2Replay) return null;
    return v2Replay.hpTimeline;
  }, [isUsingV2, v2Replay]);

  const highlights = isUsingV2 ? v2Highlights : [];

  const handleReturnHome = () => {
    resetCurrentBattle();
    if (v2EngineRef.current) {
      v2EngineRef.current.dispose();
      v2EngineRef.current = null;
    }
    navigate('/');
  };

  const handleSaveReplay = () => {
    if (isUsingV2 && v2Replay) {
      const ok = useGameStore.getState().saveCurrentReplay();
      alert(ok ? '回放已保存到本地！' : '保存失败（可能存储空间已满）');
    }
  };

  const handleViewShareCard = (card: ShareCardData) => {
    setSelectedCard(card);
    setShowCardModal(true);
  };

  const hasNoData = !replay && !v2Replay;
  if (hasNoData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-game-bg">
        <div className="text-center">
          <div className="text-2xl text-game-gold animate-pulse mb-4">加载录像中...</div>
          <button
            onClick={handleReturnHome}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-game-card border border-game-gold/30 text-gray-300 hover:text-game-gold hover:border-game-gold/60 transition-all mx-auto"
          >
            <ArrowLeft size={20} />
            <span>返回首页</span>
          </button>
        </div>
      </div>
    );
  }

  // === Helper: event description ===
  const getEventDescription = (): { icon: React.ReactNode; title: string; details: string; badge: string; badgeColor: string } | null => {
    if (isUsingV2 && playbackState?.currentEvent) {
      const ev = playbackState.currentEvent;
      switch (ev.type) {
        case 'match_runes':
          return {
            icon: <Zap size={20} />,
            title: '符文消除',
            details: `消除 ${ev.payload.matchCount} 个${ELEMENT_COLORS[ev.payload.element as ElementType] ? ev.payload.element : ''}属性符文，能量+${JSON.stringify(ev.payload.energyGained)}`,
            badge: '消除',
            badgeColor: 'bg-green-500/20 text-green-400 border-green-500/40',
          };
        case 'chain_combo':
          return {
            icon: <Flame size={20} />,
            title: `${ev.payload.totalChainCount}连消`,
            details: `连击等级 ${ev.payload.comboLevel}，共消除 ${JSON.stringify(ev.payload.totalRuneCount)} 个符文`,
            badge: '连消',
            badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
          };
        case 'cast_spell':
          return {
            icon: <Zap size={20} />,
            title: `施放: ${ev.payload.spellName}`,
            details: `伤害 ${ev.payload.damageDealt}${ev.payload.healAmount > 0 ? `，治疗 ${ev.payload.healAmount}` : ''}${ev.payload.isCritical ? ' 暴击！' : ''}${ev.payload.targetKilled ? ' 击杀！' : ''}`,
            badge: '法术',
            badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
          };
        case 'cast_combo_spell':
          return {
            icon: <Star size={20} />,
            title: `连携技: ${ev.payload.spellName}`,
            details: `伤害 ${ev.payload.damageDealt}${ev.payload.targetKilled ? ' 击杀！' : ''}`,
            badge: '连携',
            badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
          };
        case 'enemy_behavior':
          return {
            icon: <Swords size={20} />,
            title: `敌人: ${ev.payload.behaviorDescription || ev.payload.description}`,
            details: `对玩家伤害 ${ev.payload.damageToPlayer || 0}${ev.payload.isBerserk ? '（狂暴状态）' : ''}`,
            badge: '敌人',
            badgeColor: 'bg-red-500/20 text-red-400 border-red-500/40',
          };
        case 'turn_start':
          return {
            icon: <Circle size={16} />,
            title: `第 ${ev.payload.turn} 回合开始`,
            details: '玩家行动阶段',
            badge: '回合',
            badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
          };
        case 'turn_end':
          return {
            icon: <Circle size={16} />,
            title: `第 ${ev.payload.turn} 回合结束`,
            details: '准备进入敌人行动',
            badge: '回合',
            badgeColor: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
          };
        case 'terrain_effect':
          return {
            icon: <Flame size={20} />,
            title: '地形效果',
            details: `${ev.payload.effectDescription}（影响 ${ev.payload.affectedRuneCount} 格）`,
            badge: '地形',
            badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
          };
        default:
          return {
            icon: <Circle size={16} />,
            title: ev.type,
            details: '',
            badge: '事件',
            badgeColor: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
          };
      }
    }
    if (currentAction) {
      return {
        icon: <Zap size={20} />,
        title: currentAction.actionType,
        details: currentAction.description,
        badge: currentAction.side === 'attacker' ? '进攻方' : '防守方',
        badgeColor:
          currentAction.side === 'attacker'
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
            : 'bg-red-500/20 text-red-400 border-red-500/40',
      };
    }
    return null;
  };

  const eventDesc = getEventDescription();
  const currentActionElement =
    isUsingV2 && playbackState?.currentEvent?.type === 'match_runes'
      ? (playbackState.currentEvent.payload.element as ElementType)
      : isUsingV2 && (playbackState?.currentEvent?.type === 'cast_spell' || playbackState?.currentEvent?.type === 'cast_combo_spell')
      ? 'fire'
      : currentAction?.actionType === 'match_runes'
      ? (currentAction.payload?.element as ElementType)
      : currentAction?.actionType === 'cast_spell'
      ? SPELLS.find((s) => s.id === currentAction.payload?.spellId)?.element
      : undefined;

  const shareCards = useGameStore.getState().lastReplayShareCards;

  return (
    <div className="min-h-screen w-full overflow-auto p-4 md:p-6 bg-game-bg">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <button
            onClick={handleReturnHome}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-game-card border border-game-gold/30 text-gray-300 hover:text-game-gold hover:border-game-gold/60 transition-all"
          >
            <ArrowLeft size={20} />
            <span>返回首页</span>
          </button>
          <div className="flex items-center gap-2 text-game-gold font-display text-xl md:text-2xl">
            <Swords size={28} />
            <span>{isUsingV2 ? '战斗回放' : '对战录像回放'}</span>
          </div>
          <div className="flex items-center gap-2">
            {isUsingV2 && v2Replay && (
              <button
                onClick={handleSaveReplay}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-game-card border border-game-gold/30 text-gray-300 hover:text-game-gold hover:border-game-gold/60 transition-all text-sm"
              >
                <Download size={16} />
                <span>保存</span>
              </button>
            )}
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <Clock size={16} />
              <span>
                {isUsingV2 ? formatDuration(v2Replay?.durationMs || 0) : battleRecord ? formatDuration(battleRecord.durationMs) : '--:--'}
              </span>
            </div>
          </div>
        </div>

        {/* HP Panels */}
        <div className="game-card p-4 md:p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <div
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shrink-0"
                style={{
                  border: '4px solid #3b82f6',
                  background: '#3b82f620',
                  boxShadow: '0 0 20px #3b82f640',
                }}
              >
                <span className="text-3xl md:text-4xl">🧙</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-white text-lg truncate">
                    {isUsingV2 ? '玩家' : battleRecord?.attackerName || currentProfile?.playerName || '进攻方'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs border border-blue-500/40 shrink-0">
                    {isUsingV2 ? '玩家' : '进攻方'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1 text-gray-300">
                      <Heart size={12} className="text-red-400" />
                      HP
                    </span>
                    <span className="font-bold text-white">
                      {Math.max(0, Math.round(playerHp))}/{playerMaxHp}
                    </span>
                  </div>
                  <div className="health-bar h-3">
                    <div
                      className={`health-bar-fill ${getHpBarColor(playerHpPct)} transition-all duration-500`}
                      style={{ width: `${playerHpPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-row-reverse md:flex-row">
              <div
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shrink-0"
                style={{
                  border: '4px solid #ef4444',
                  background: '#ef444420',
                  boxShadow: '0 0 20px #ef444440',
                }}
              >
                <span className="text-3xl md:text-4xl">👹</span>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center gap-2 mb-1 justify-end">
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs border border-red-500/40 shrink-0">
                    {isUsingV2 ? '敌人' : '防守方'}
                  </span>
                  <h3 className="font-bold text-white text-lg truncate">
                    {isUsingV2 ? (v2Replay?.enemyName || 'BOSS') : battleRecord?.defenderName || 'AI防守者'}
                  </h3>
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  {isUsingV2 ? `${v2Replay?.levelName || ''}` : ''}
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1 text-gray-300">
                      <Heart size={12} className="text-red-400" />
                      HP
                    </span>
                    <span className="font-bold text-white">
                      {Math.max(0, Math.round(enemyHp))}/{enemyMaxHp}
                    </span>
                  </div>
                  <div className="health-bar h-3">
                    <div
                      className={`health-bar-fill ${getHpBarColor(enemyHpPct)} transition-all duration-500`}
                      style={{ width: `${enemyHpPct}%` }}
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
                回合 <span className="text-game-gold font-bold">{currentTurnDisp}</span>
                <span className="mx-2">/</span>
                共 <span className="text-game-gold font-bold">{totalTurnsDisp}</span> 回合
              </div>
              <div className="text-xs text-gray-500 mt-1">
                事件 {currentEventIdx + 1}/{currentEventCount}
                {isUsingV2 && v2Replay ? ` · ${formatTimestamp(v2Replay.recordedAt)}` : ''}
              </div>
            </div>
            <div className="flex-1 h-0.5 bg-gradient-to-l from-transparent via-red-500/50 to-red-500" />
          </div>

          <div className="grid grid-cols-4 gap-2 md:gap-4 mb-4">
            {elements.map((el) => (
              <div key={el} className="bg-game-bg-dark rounded-lg p-2 md:p-3 text-center">
                <div className="text-xl md:text-2xl mb-1">{ELEMENT_ICONS[el]}</div>
                <div className="text-xs md:text-sm font-bold" style={{ color: ELEMENT_COLORS[el] }}>
                  {energy[el] || 0}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="game-card p-4 md:p-6 mb-6">
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <span className="text-gray-400">
                  进度 {currentEventIdx + 1} / {currentEventCount}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {speedOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSetSpeed(s)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      (isUsingV2 ? v2Speed : playbackSpeedV1) === s
                        ? 'bg-game-gold text-game-bg-dark shadow-md shadow-game-gold/30'
                        : 'bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              {/* Highlight markers on timeline */}
              {highlights.length > 0 && (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none z-20">
                  {highlights.map((hl, i) => {
                    const pct = (hl.startEventIndex / Math.max(1, v2EventCount - 1)) * 100;
                    const meta = HIGHLIGHT_TYPE_META[hl.type];
                    return (
                      <div
                        key={i}
                        className="absolute -translate-y-1/2"
                        style={{ left: `${Math.max(1, Math.min(99, pct))}%` }}
                        title={`${meta?.name || hl.type}${hl.description ? ': ' + hl.description : ''}`}
                      >
                        <div
                          className="w-3 h-3 rounded-full border-2 border-white animate-pulse"
                          style={{ background: meta?.color || '#d4af37', boxShadow: `0 0 8px ${meta?.color || '#d4af37'}` }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
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
                style={{ WebkitAppearance: 'none' }}
              />
              <style>{`
                input[type="range"]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  width: 18px; height: 18px;
                  border-radius: 50%;
                  background: #d4af37;
                  border: 2px solid #fff;
                  cursor: pointer;
                  box-shadow: 0 0 10px rgba(212, 175, 55, 0.8);
                }
                input[type="range"]::-moz-range-thumb {
                  width: 18px; height: 18px;
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
              onClick={handleJumpToStart}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="跳到开始"
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
              onClick={handleStepBack}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="上一步"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={handleTogglePlay}
              className="p-3 md:p-4 rounded-xl bg-gradient-to-br from-game-gold to-game-gold-light text-game-bg-dark hover:scale-105 transition-transform shadow-lg shadow-game-gold/30"
              title={(isUsingV2 ? v2IsPlaying : isPlayingV1) ? '暂停' : '播放'}
            >
              {(isUsingV2 ? v2IsPlaying : isPlayingV1) ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              onClick={handleStepForward}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="下一步"
            >
              <ChevronRight size={24} />
            </button>
            <button
              onClick={handleNextTurn}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="下一回合"
            >
              <SkipForward size={20} />
            </button>
            <button
              onClick={handleJumpToEnd}
              className="p-2 md:p-3 rounded-lg bg-game-bg-dark border border-game-gold/20 text-gray-300 hover:text-game-gold hover:border-game-gold/50 transition-all"
              title="跳到结束"
            >
              <FastForward size={20} />
            </button>
          </div>

          {eventDesc && (
            <div className="mt-4 p-3 md:p-4 rounded-xl bg-gradient-to-r from-game-gold/10 to-transparent border border-game-gold/20">
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <div className={`px-2 py-1 rounded-md text-xs font-bold shrink-0 ${eventDesc.badgeColor} border`}>
                  {eventDesc.badge}
                </div>
                <div className="flex items-center gap-2 text-white font-bold">
                  {eventDesc.icon}
                  <span>{eventDesc.title}</span>
                </div>
                {eventDesc.details && (
                  <span className="text-gray-300 text-sm md:text-base flex-1 min-w-0 truncate">
                    {eventDesc.details}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Grid + HP Curve */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="game-card p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Zap size={22} className="text-game-gold" />
              <h3 className="text-lg font-bold text-game-gold font-display">模拟棋盘</h3>
              <span className="ml-auto text-xs text-gray-400">
                {isUsingV2 ? '回合 ' + currentTurnDisp : ''}
              </span>
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
                    const isHighlighted = isUsingV2
                      ? !!playbackState?.highlightedCells?.some(
                          (c) => c.row === rune.row && c.col === rune.col
                        )
                      : false;
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
            </div>
          </div>

          {/* HP Curve + Highlights */}
          <div className="game-card p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Heart size={22} className="text-game-gold" />
              <h3 className="text-lg font-bold text-game-gold font-display">血量变化曲线</h3>
            </div>
            {hpCurve && hpCurve.player.length > 1 ? (
              <div className="space-y-4">
                <div className="h-40 bg-game-bg-dark rounded-xl p-3 relative overflow-hidden border border-game-gold/10">
                  <svg className="w-full h-full" viewBox={`0 0 ${hpCurve.player.length * 2} 100`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="playerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="enemyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Player HP area */}
                    <path
                      d={hpCurve.player
                        .map((v, i) => {
                          const pct = 100 - (v / playerMaxHp) * 100;
                          return `${i === 0 ? 'M' : 'L'} ${i * 2} ${pct}`;
                        })
                        .join(' ')}
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      fill="none"
                    />
                    <path
                      d={
                        hpCurve.player
                          .map((v, i) => {
                            const pct = 100 - (v / playerMaxHp) * 100;
                            return `${i === 0 ? 'M' : 'L'} ${i * 2} ${pct}`;
                          })
                          .join(' ') + ` L ${(hpCurve.player.length - 1) * 2} 100 L 0 100 Z`
                      }
                      fill="url(#playerGrad)"
                    />
                    {/* Enemy HP area */}
                    <path
                      d={hpCurve.enemy
                        .map((v, i) => {
                          const pct = 100 - (v / enemyMaxHp) * 100;
                          return `${i === 0 ? 'M' : 'L'} ${i * 2} ${pct}`;
                        })
                        .join(' ')}
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      fill="none"
                    />
                    <path
                      d={
                        hpCurve.enemy
                          .map((v, i) => {
                            const pct = 100 - (v / enemyMaxHp) * 100;
                            return `${i === 0 ? 'M' : 'L'} ${i * 2} ${pct}`;
                          })
                          .join(' ') + ` L ${(hpCurve.enemy.length - 1) * 2} 100 L 0 100 Z`
                      }
                      fill="url(#enemyGrad)"
                    />
                    {/* Turn markers */}
                    {hpCurve.turnMarkers.map((m, i) => (
                      <line
                        key={i}
                        x1={m * 2}
                        x2={m * 2}
                        y1={0}
                        y2={100}
                        stroke="#d4af37"
                        strokeWidth="0.5"
                        strokeDasharray="2 2"
                        opacity={0.5}
                      />
                    ))}
                  </svg>
                  <div className="absolute top-2 right-2 text-[10px] space-y-1">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-blue-500" />
                      <span className="text-blue-400">玩家HP</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-red-500" style={{ borderTop: '1px dashed' }} />
                      <span className="text-red-400">敌人HP</span>
                    </div>
                  </div>
                </div>

                {/* Highlights list */}
                {highlights.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Star size={16} className="text-yellow-400" />
                      <span className="text-sm font-bold text-yellow-400">
                        高光时刻 ({highlights.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {highlights.map((hl, i) => {
                        const meta = HIGHLIGHT_TYPE_META[hl.type];
                        return (
                          <button
                            key={i}
                            onClick={() => handleJumpToHighlight(i)}
                            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:scale-105"
                            style={{
                              background: `${meta?.color || '#d4af37'}20`,
                              borderColor: `${meta?.color || '#d4af37'}60`,
                              color: meta?.color || '#d4af37',
                            }}
                          >
                            <span>{meta?.icon || '⭐'}</span>
                            <span className="truncate max-w-[120px]">
                              {meta?.name || hl.type}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Share cards */}
                {shareCards && shareCards.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Share2 size={16} className="text-game-gold" />
                      <span className="text-sm font-bold text-game-gold">
                        分享卡片 ({shareCards.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shareCards.slice(0, 3).map((card, i) => (
                        <button
                          key={i}
                          onClick={() => handleViewShareCard(card)}
                          className="px-3 py-2 rounded-lg border border-game-gold/40 bg-game-gold/10 hover:bg-game-gold/20 transition-all text-xs text-game-gold font-bold flex items-center gap-1"
                          style={{
                            borderColor: `${card.primaryColor || '#d4af37'}60`,
                            background: `${card.primaryColor || '#d4af37'}15`,
                            color: card.primaryColor || '#d4af37',
                          }}
                        >
                          <Star size={14} />
                          <span>{card.highlightName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-40 bg-game-bg-dark rounded-xl p-3 flex items-center justify-center text-gray-500 text-sm border border-game-gold/10">
                血量曲线数据不可用
              </div>
            )}
          </div>
        </div>

        {/* Event list (V1 only, for compatibility) */}
        {!isUsingV2 && replay && (
          <div className="game-card p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flame size={22} className="text-game-gold" />
              <h3 className="text-lg font-bold text-game-gold font-display">动作列表</h3>
            </div>

            <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
              {Array.from(actionsByTurn.entries())
                .sort(([a], [b]) => a - b)
                .map(([turn, actions]) => (
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
                            onClick={() => {
                              setIsPlayingV1(false);
                              setCurrentActionIndex(actionGlobalIndex);
                            }}
                            className={`w-full text-left p-2 md:p-3 rounded-lg transition-all ${
                              isActive
                                ? 'bg-game-gold/20 border border-game-gold/60 shadow-lg shadow-game-gold/10'
                                : 'bg-game-bg-dark/50 border border-transparent hover:border-game-gold/30 hover:bg-game-bg-dark'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                  action.side === 'attacker'
                                    ? 'bg-blue-500/30 text-blue-300'
                                    : 'bg-red-500/30 text-red-300'
                                }`}
                              >
                                {action.side === 'attacker' ? '攻' : '防'}
                              </span>
                              <span className="text-xs md:text-sm text-gray-200 flex-1 min-w-0 truncate">
                                {action.description}
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
        )}

        {/* Share Card Modal */}
        {showCardModal && selectedCard && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowCardModal(false)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl border-2"
              style={{
                background: `linear-gradient(135deg, ${selectedCard.primaryColor}20 0%, #1a1a2e 50%, ${selectedCard.accentColor}20 100%)`,
                borderColor: selectedCard.primaryColor,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowCardModal(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
              >
                ✕
              </button>
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                    style={{
                      background: `${selectedCard.primaryColor}30`,
                      border: `2px solid ${selectedCard.primaryColor}`,
                      boxShadow: `0 0 20px ${selectedCard.primaryColor}60`,
                    }}
                  >
                    {HIGHLIGHT_TYPE_META[selectedCard.highlightType as keyof typeof HIGHLIGHT_TYPE_META]?.icon || '⭐'}
                  </div>
                </div>
                <div>
                  <div
                    className="text-xl md:text-2xl font-black font-display"
                    style={{ color: selectedCard.primaryColor }}
                  >
                    {selectedCard.highlightName}
                  </div>
                  <div className="text-gray-400 text-sm mt-1">
                    {selectedCard.enemyName} · 第{selectedCard.turnNumber}回合
                  </div>
                </div>
                <div
                  className="rounded-xl p-4 space-y-2"
                  style={{
                    background: `${selectedCard.primaryColor}15`,
                    border: `1px solid ${selectedCard.primaryColor}40`,
                  }}
                >
                  {Object.entries(selectedCard.stats).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-bold text-white">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-white/10 text-xs text-gray-500">
                  战斗ID: {selectedCard.battleId?.slice(0, 12)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
