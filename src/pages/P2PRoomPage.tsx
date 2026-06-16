import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArenaStore } from '../store/useArenaStore';
import { useEquipmentStore } from '../store/useEquipmentStore';
import {
  ArrowLeft,
  Users,
  Copy,
  Check,
  Play,
  RefreshCw,
  Shield,
  Swords,
  Brain,
  Flame,
  ShieldCheck,
  Scale,
  Target,
  Shuffle,
  Wifi,
  WifiOff,
  Clock,
  AlertTriangle,
  Crown,
  Zap,
  X,
} from 'lucide-react';
import type {
  DefenderAIStyle,
  P2PSession,
  DefenderLoadout,
  ArenaPlayerProfile,
} from '../types';
import {
  ELEMENT_COLORS,
  ELEMENT_ICONS,
  SPELLS,
  DEFENDER_AI_STYLE_NAMES,
  DEFENDER_AI_STYLE_DESC,
  GRID_SIZE,
} from '../types';
import { P2PConnectionManager, generateRoomCode } from '../utils/p2pConnectionManager';
import { P2PBattleController } from '../utils/p2pBattleController';

const AI_STYLE_ICONS: Record<DefenderAIStyle, React.ReactNode> = {
  aggressive: <Flame size={18} />,
  defensive: <ShieldCheck size={18} />,
  balanced: <Scale size={18} />,
  tactical: <Target size={18} />,
  random: <Shuffle size={18} />,
};

const AI_STYLE_COLORS: Record<DefenderAIStyle, string> = {
  aggressive: '#ef4444',
  defensive: '#3b82f6',
  balanced: '#22c55e',
  tactical: '#a855f7',
  random: '#f59e0b',
};

export const P2PRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentProfile, currentLoadout, initializeArena, startP2PBattle } = useArenaStore();
  const { inventory, highestLevel, getAvailableSlots, load: loadEquipment } = useEquipmentStore();

  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<P2PSession | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showModeSelect, setShowModeSelect] = useState(true);

  const connectionManagerRef = useRef<P2PConnectionManager | null>(null);
  const battleControllerRef = useRef<P2PBattleController | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    initializeArena();
    loadEquipment();

    const timer = setTimeout(() => {
      const state = useArenaStore.getState();
      if (!state.currentProfile) {
        state.createOrUpdateProfile('玩家');
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [initializeArena, loadEquipment]);

  const getActiveLoadout = useCallback((): DefenderLoadout | null => {
    const loadouts = useArenaStore.getState().loadouts;
    const activeId = useArenaStore.getState().activeLoadoutId;
    return loadouts.find((l) => l.id === activeId) || loadouts[0] || null;
  }, []);

  const handleCreateRoom = async () => {
    if (!currentProfile) return;

    setIsCreating(true);
    setRoomError('');

    try {
      const newRoomCode = generateRoomCode();
      setRoomCode(newRoomCode);
      setIsHost(true);

      connectionManagerRef.current = new P2PConnectionManager({
        transportType: 'local',
        playerProfile: currentProfile,
        playerLoadout: getActiveLoadout()!,
      });

      const unsub = connectionManagerRef.current.onSessionUpdate((newSession) => {
        setSession({ ...newSession });
        if (newSession.phase === 'battle_ready') {
          startCountdown();
        }
      });

      const success = await connectionManagerRef.current.createRoom(newRoomCode);
      if (!success) {
        throw new Error('创建房间失败');
      }
      setShowModeSelect(false);
    } catch (error: any) {
      setRoomError(error.message || '创建房间失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!currentProfile) return;

    const trimmed = inputRoomCode.trim().toUpperCase();
    if (!trimmed || trimmed.length !== 6) {
      setRoomError('请输入有效的6位房间码');
      return;
    }

    setIsJoining(true);
    setRoomError('');

    try {
      setRoomCode(trimmed);
      setIsHost(false);

      connectionManagerRef.current = new P2PConnectionManager({
        transportType: 'local',
        playerProfile: currentProfile,
        playerLoadout: getActiveLoadout()!,
      });

      const unsub = connectionManagerRef.current.onSessionUpdate((newSession) => {
        setSession({ ...newSession });
        if (newSession.phase === 'battle_ready') {
          startCountdown();
        }
      });

      const success = await connectionManagerRef.current.joinRoom(trimmed);
      if (!success) {
        throw new Error('加入房间失败，房间码无效或房间不存在');
      }
      setShowModeSelect(false);
    } catch (error: any) {
      setRoomError(error.message || '加入房间失败');
    } finally {
      setIsJoining(false);
    }
  };

  const startCountdown = () => {
    let count = 3;
    setCountdown(count);

    countdownTimerRef.current = setInterval(() => {
      count--;
      setCountdown(count);

      if (count <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
        startBattle();
      }
    }, 1000);
  };

  const startBattle = () => {
    if (!connectionManagerRef.current || !currentProfile) return;

    if (isHost) {
      connectionManagerRef.current.sendBattleInit(true);
    }

    battleControllerRef.current = new P2PBattleController({
      connectionManager: connectionManagerRef.current,
      myProfile: currentProfile,
      myLoadout: getActiveLoadout()!,
      isHost,
    });

    startP2PBattle(battleControllerRef.current, isHost);
    navigate('/arena/battle');
  };

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = roomCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBack = () => {
    if (connectionManagerRef.current) {
      connectionManagerRef.current.disconnect();
    }
    navigate('/arena');
  };

  const renderLoadoutPreview = (loadout: DefenderLoadout | null, profile: ArenaPlayerProfile | null, isMe: boolean) => {
    if (!loadout || !profile) return null;

    const spells = SPELLS.filter((s) => loadout.selectedSpellIds.includes(s.id));
    const slots = getAvailableSlots(highestLevel);
    const equippedRunes = inventory.filter((r) => loadout.selectedRuneIds.includes(r.id));

    return (
      <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: isMe ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}
            >
              {isMe ? '😊' : '🤖'}
            </div>
            {isHost && isMe && (
              <div className="absolute -top-1 -right-1">
                <Crown size={14} className="text-yellow-400 fill-yellow-400" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">{profile.playerName}</span>
              {isMe && (
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">我</span>
              )}
            </div>
            <div className="text-xs text-gray-400">段位: {profile.currentRank}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex" style={{ color: AI_STYLE_COLORS[loadout.aiStyle] }}>
              {AI_STYLE_ICONS[loadout.aiStyle]}
            </div>
            <span className="text-sm text-gray-300">
              {DEFENDER_AI_STYLE_NAMES[loadout.aiStyle]}
            </span>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">生命值</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-400"
                  style={{ width: `${(loadout.playerMaxHp / 150) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{loadout.playerMaxHp}</span>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">符文装备 ({equippedRunes.length}/{slots.total})</div>
            <div className="flex flex-wrap gap-1">
              {equippedRunes.slice(0, 6).map((rune) => (
                <div
                  key={rune.id}
                  className="w-8 h-8 rounded flex items-center justify-center"
                  style={{ backgroundColor: ELEMENT_COLORS[rune.element] + '40' }}
                >
                  {ELEMENT_ICONS[rune.element as keyof typeof ELEMENT_ICONS]}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">法术 ({spells.length}/4)</div>
            <div className="flex flex-wrap gap-1">
              {spells.map((spell) => (
                <div
                  key={spell.id}
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: ELEMENT_COLORS[spell.element] + '30',
                    color: ELEMENT_COLORS[spell.element],
                  }}
                >
                  {spell.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!currentProfile || !currentLoadout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-game-gold text-xl animate-pulse">加载中...</div>
      </div>
    );
  }

  const activeLoadout = getActiveLoadout();

  return (
    <div className="min-h-screen w-full overflow-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>返回</span>
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-game-gold" />
            联机对战
          </h1>
          <div className="w-20" />
        </div>

        {showModeSelect ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div
              onClick={!isCreating ? handleCreateRoom : undefined}
              className={`bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-2xl p-8 border-2 
                ${isCreating ? 'border-blue-500 animate-pulse' : 'border-blue-700 hover:border-blue-500 cursor-pointer'}
                transition-all duration-300`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Crown size={32} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">创建房间</h2>
                  <p className="text-sm text-gray-400">作为主机创建对战</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                创建一个新房间，将房间码分享给好友，等待对方加入后开始对战。
                主机将作为裁判端确保数据同步。
              </p>
              {isCreating && (
                <div className="flex items-center gap-2 text-blue-400">
                  <RefreshCw size={16} className="animate-spin" />
                  <span>创建中...</span>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-2xl p-8 border-2 border-purple-700">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Users size={32} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">加入房间</h2>
                  <p className="text-sm text-gray-400">输入房间码加入对战</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={inputRoomCode}
                    onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                    placeholder="请输入6位房间码"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-gray-900/80 border border-gray-600 rounded-xl 
                      text-white text-center text-2xl tracking-widest font-mono
                      focus:border-purple-500 focus:outline-none uppercase"
                    disabled={isJoining}
                  />
                </div>

                {roomError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle size={14} />
                    <span>{roomError}</span>
                  </div>
                )}

                <button
                  onClick={handleJoinRoom}
                  disabled={isJoining || inputRoomCode.length !== 6}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 
                    disabled:cursor-not-allowed text-white font-bold rounded-xl
                    flex items-center justify-center gap-2 transition-colors"
                >
                  {isJoining ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>加入中...</span>
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      <span>加入房间</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-700">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">房间码</div>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-4xl font-mono font-bold tracking-widest text-game-gold">
                    {roomCode}
                  </div>
                  <button
                    onClick={handleCopyRoomCode}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                  >
                    {copied ? (
                      <Check size={20} className="text-green-400" />
                    ) : (
                      <Copy size={20} className="text-gray-400" />
                    )}
                  </button>
                </div>

                {session && (
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      {session.connectionState === 'connected' ? (
                        <Wifi size={14} className="text-green-400" />
                      ) : session.connectionState === 'reconnecting' ? (
                        <RefreshCw size={14} className="text-yellow-400 animate-spin" />
                      ) : (
                        <WifiOff size={14} className="text-red-400" />
                      )}
                      <span className={
                        session.connectionState === 'connected' ? 'text-green-400' :
                        session.connectionState === 'reconnecting' ? 'text-yellow-400' :
                        'text-red-400'
                      }>
                        {session.connectionState === 'connected' ? '已连接' :
                         session.connectionState === 'reconnecting' ? '重连中' :
                         session.connectionState === 'disconnected' ? '已断开' : '连接中'}
                      </span>
                    </div>
                    <div className="text-gray-500">|</div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Users size={14} />
                      <span>{session.peerConnected ? '2/2' : '1/2'}</span>
                    </div>
                    <div className="text-gray-500">|</div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock size={14} />
                      <span>
                        {session.phase === 'waiting' ? '等待对手' :
                         session.phase === 'handshake' ? '握手中' :
                         session.phase === 'loadout_sync' ? '同步数据' :
                         session.phase === 'battle_ready' ? '准备开始' : '战斗中'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {countdown !== null && countdown > 0 && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="text-center">
                  <div className="text-9xl font-bold text-game-gold animate-bounce">
                    {countdown}
                  </div>
                  <div className="text-2xl text-white mt-4">战斗即将开始</div>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-blue-400 font-bold mb-3 flex items-center gap-2">
                  <Shield size={16} />
                  我方装配
                </div>
                {renderLoadoutPreview(activeLoadout, currentProfile, true)}
              </div>

              <div>
                <div className="text-red-400 font-bold mb-3 flex items-center gap-2">
                  <Swords size={16} />
                  对手装配
                </div>
                {session?.peerProfile && session?.peerLoadout ? (
                  renderLoadoutPreview(session.peerLoadout, session.peerProfile, false)
                ) : (
                  <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-700 h-full flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Users size={48} className="mx-auto mb-2 opacity-50" />
                      <p>等待对手加入...</p>
                      <p className="text-xs mt-1">请将房间码分享给好友</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {roomError && (
              <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                <span className="text-red-300">{roomError}</span>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <button
                onClick={handleBack}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold 
                  rounded-xl flex items-center gap-2 transition-colors"
              >
                <X size={18} />
                取消
              </button>
              {session?.phase === 'battle_ready' && isHost && countdown === null && (
                <button
                  onClick={startCountdown}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-500 
                    hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl
                    flex items-center gap-2 transition-all"
                >
                  <Play size={18} />
                  开始对战
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
            <Zap size={14} />
            联机对战说明
          </h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• 本功能采用点对点直连技术，无需中央服务器</li>
            <li>• 主机作为裁判端，负责数据同步验证和结果仲裁</li>
            <li>• 一方掉线后有30秒重连时间，超时自动判负</li>
            <li>• 支持断线重连，最多尝试5次重新连接</li>
            <li>• 对战结果将正常计入段位积分和成就系统</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
