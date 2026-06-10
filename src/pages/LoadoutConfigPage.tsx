import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArenaStore } from '../store/useArenaStore';
import { useEquipmentStore } from '../store/useEquipmentStore';
import type {
  ElementType,
  DefenderAIStyle,
  RuneEquipment,
  Spell,
  EnemyAIConfig,
} from '../types';
import {
  ELEMENT_NAMES,
  ELEMENT_ICONS,
  ELEMENT_COLORS,
  QUALITY_NAMES,
  QUALITY_COLORS,
  QUALITY_BG,
  AFFIX_NAMES,
  AFFIX_ICONS,
  AFFIX_FORMAT,
  SPELLS,
  DEFENDER_AI_STYLE_NAMES,
  DEFENDER_AI_STYLE_DESC,
  DEFAULT_AI_CONFIG,
  getSlotsForLevel,
} from '../types';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Swords,
  Shield,
  Brain,
  Settings,
  Heart,
  Copy,
  CheckCircle,
  Code,
  Flame,
  ShieldCheck,
  Scale,
  Target,
  Shuffle,
  ChevronDown,
  ChevronUp,
  Zap,
  Skull,
  Clock,
  Crown,
} from 'lucide-react';
import EquipmentCard from '../components/EquipmentCard';

const ELEMENTS: ElementType[] = ['fire', 'water', 'grass', 'thunder'];
const MAX_SPELLS = 4;

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

export const LoadoutConfigPage: React.FC = () => {
  const navigate = useNavigate();

  const {
    currentProfile,
    currentLoadout,
    initializeArena,
    createOrUpdateProfile,
    createLoadout,
    updateLoadout,
    deleteLoadout,
    setActiveLoadout,
    generateBattleCode,
  } = useArenaStore();

  const {
    inventory,
    highestLevel,
    getAvailableSlots,
    load: loadEquipment,
  } = useEquipmentStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showAdvancedAI, setShowAdvancedAI] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    initializeArena();
    loadEquipment();
    if (!currentProfile) {
      createOrUpdateProfile('玩家');
    }
  }, [initializeArena, loadEquipment, createOrUpdateProfile, currentProfile]);

  const loadouts = currentProfile?.loadouts || [];
  const currentIndex = useMemo(() => {
    if (!currentProfile?.currentLoadoutId || loadouts.length === 0) return 0;
    return Math.max(0, loadouts.findIndex((l) => l.id === currentProfile.currentLoadoutId));
  }, [currentProfile?.currentLoadoutId, loadouts]);

  const activeLoadout = currentLoadout || loadouts[currentIndex] || null;
  const availableSlots = getAvailableSlots();

  const getInventoryItem = (id: string): RuneEquipment | undefined =>
    inventory.find((item) => item.id === id);

  const getEquippedForElement = (element: ElementType): (RuneEquipment | null)[] => {
    if (!activeLoadout) return Array(availableSlots).fill(null);
    const slots = activeLoadout.equippedRunes[element] || [];
    const result: (RuneEquipment | null)[] = [];
    for (let i = 0; i < availableSlots; i++) {
      const id = slots[i];
      if (id) {
        const item = getInventoryItem(id);
        result.push(item || null);
      } else {
        result.push(null);
      }
    }
    return result;
  };

  const getElementInventory = (element: ElementType) =>
    inventory.filter((item) => item.element === element);

  const getSelectedSpells = (): Spell[] => {
    if (!activeLoadout) return [];
    return activeLoadout.selectedSpellIds
      .map((id) => SPELLS.find((s) => s.id === id))
      .filter((s): s is Spell => !!s);
  };

  const getUnselectedSpells = (): Spell[] => {
    if (!activeLoadout) return SPELLS;
    return SPELLS.filter((s) => !activeLoadout.selectedSpellIds.includes(s.id));
  };

  const handlePrevLoadout = () => {
    if (currentIndex > 0) {
      setActiveLoadout(loadouts[currentIndex - 1].id);
    } else if (loadouts.length > 0) {
      setActiveLoadout(loadouts[loadouts.length - 1].id);
    }
  };

  const handleNextLoadout = () => {
    if (currentIndex < loadouts.length - 1) {
      setActiveLoadout(loadouts[currentIndex + 1].id);
    } else if (loadouts.length > 0) {
      setActiveLoadout(loadouts[0].id);
    }
  };

  const handleCreateLoadout = () => {
    const idx = loadouts.length + 1;
    createLoadout(`阵容${idx}`);
  };

  const handleDeleteLoadout = () => {
    if (!activeLoadout || loadouts.length <= 1) return;
    if (confirm(`确定要删除阵容「${activeLoadout.name}」吗？`)) {
      deleteLoadout(activeLoadout.id);
    }
  };

  const handleStartRename = () => {
    if (!activeLoadout) return;
    setRenamingId(activeLoadout.id);
    setRenameValue(activeLoadout.name);
  };

  const handleConfirmRename = () => {
    if (!activeLoadout || !renameValue.trim()) return;
    updateLoadout(activeLoadout.id, { name: renameValue.trim() });
    setRenamingId(null);
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleEquipRune = (element: ElementType, slotIndex: number, equipmentId: string) => {
    if (!activeLoadout) return;
    const currentEquipped = { ...(activeLoadout.equippedRunes || {}) };
    const elementSlots = [...(currentEquipped[element] || [])];
    while (elementSlots.length < availableSlots) elementSlots.push(null);
    elementSlots[slotIndex] = equipmentId;
    currentEquipped[element] = elementSlots;
    updateLoadout(activeLoadout.id, { equippedRunes: currentEquipped });
  };

  const handleUnequipRune = (element: ElementType, slotIndex: number) => {
    if (!activeLoadout) return;
    const currentEquipped = { ...(activeLoadout.equippedRunes || {}) };
    const elementSlots = [...(currentEquipped[element] || [])];
    while (elementSlots.length < availableSlots) elementSlots.push(null);
    elementSlots[slotIndex] = null;
    currentEquipped[element] = elementSlots;
    updateLoadout(activeLoadout.id, { equippedRunes: currentEquipped });
  };

  const handleSelectSpell = (spellId: string) => {
    if (!activeLoadout) return;
    if (activeLoadout.selectedSpellIds.length >= MAX_SPELLS) return;
    updateLoadout(activeLoadout.id, {
      selectedSpellIds: [...activeLoadout.selectedSpellIds, spellId],
    });
  };

  const handleDeselectSpell = (spellId: string) => {
    if (!activeLoadout) return;
    updateLoadout(activeLoadout.id, {
      selectedSpellIds: activeLoadout.selectedSpellIds.filter((id) => id !== spellId),
    });
  };

  const handleSetAIStyle = (style: DefenderAIStyle) => {
    if (!activeLoadout) return;
    updateLoadout(activeLoadout.id, { aiStyle: style });
  };

  const handleUpdateAIConfig = (key: keyof EnemyAIConfig, value: number) => {
    if (!activeLoadout) return;
    const currentConfig = { ...DEFAULT_AI_CONFIG, ...(activeLoadout.aiConfig || {}) };
    currentConfig[key] = value;
    updateLoadout(activeLoadout.id, { aiConfig: currentConfig });
  };

  const handleSetPlayerMaxHp = (value: number) => {
    if (!activeLoadout) return;
    const clamped = Math.max(100, Math.min(500, value));
    updateLoadout(activeLoadout.id, { playerMaxHp: clamped });
  };

  const handleGenerateBattleCode = () => {
    if (!activeLoadout) return;
    const code = generateBattleCode(activeLoadout.id);
    setGeneratedCode(code);
    setCopied(false);
  };

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = generatedCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentAIConfig = {
    ...DEFAULT_AI_CONFIG,
    ...(activeLoadout?.aiConfig || {}),
  };

  if (!currentProfile || !activeLoadout) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-game-gold text-xl animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-auto p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/arena')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-game-card border border-game-gold/30 text-gray-300 hover:text-game-gold hover:border-game-gold/60 transition-all"
          >
            <ArrowLeft size={20} />
            <span>返回竞技场</span>
          </button>
          <div className="flex items-center gap-2 text-game-gold font-display text-xl md:text-2xl">
            <Shield size={28} className="text-game-gold" />
            <span>防守阵容配置</span>
          </div>
          <div className="w-32" />
        </div>

        <div className="game-card p-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevLoadout}
              disabled={loadouts.length <= 1}
              className="p-2 rounded-lg bg-game-bg-dark text-gray-400 hover:text-white hover:bg-game-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="flex-1 flex items-center justify-center gap-4">
              {renamingId === activeLoadout.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmRename();
                      if (e.key === 'Escape') handleCancelRename();
                    }}
                    className="px-4 py-2 rounded-lg bg-game-bg-dark border border-game-gold/50 text-white text-lg font-bold focus:outline-none focus:border-game-gold w-48"
                    autoFocus
                  />
                  <button
                    onClick={handleConfirmRename}
                    className="p-2 rounded-lg bg-green-600/60 text-green-200 hover:bg-green-500/70 transition-colors"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={handleCancelRename}
                    className="p-2 rounded-lg bg-gray-600/60 text-gray-200 hover:bg-gray-500/70 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-gray-500 text-sm">
                    {currentIndex + 1} / {loadouts.length}
                  </span>
                  <h2 className="text-xl md:text-2xl font-bold text-white">{activeLoadout.name}</h2>
                  <button
                    onClick={handleStartRename}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-game-gold hover:bg-game-gold/10 transition-colors"
                    title="重命名"
                  >
                    <Edit3 size={16} />
                  </button>
                </>
              )}
            </div>

            <button
              onClick={handleNextLoadout}
              disabled={loadouts.length <= 1}
              className="p-2 rounded-lg bg-game-bg-dark text-gray-400 hover:text-white hover:bg-game-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={handleCreateLoadout}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-game-gold/20 border border-game-gold/50 text-game-gold hover:bg-game-gold/30 transition-all text-sm font-semibold"
            >
              <Plus size={16} />
              创建新阵容
            </button>
            <button
              onClick={handleDeleteLoadout}
              disabled={loadouts.length <= 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-semibold"
            >
              <Trash2 size={16} />
              删除阵容
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="game-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Swords size={20} className="text-game-gold" />
                <h3 className="text-lg font-bold text-game-gold font-display">符文装备</h3>
                <span className="ml-auto text-xs text-gray-500">
                  每元素 {availableSlots} 槽位（关卡{highestLevel}解锁）
                </span>
              </div>

              <div className="space-y-4">
                {ELEMENTS.map((element) => {
                  const equippedItems = getEquippedForElement(element);
                  const inv = getElementInventory(element);
                  const hasAny = equippedItems.some((i) => i !== null);

                  return (
                    <div key={element} className="bg-game-bg-dark/60 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{ELEMENT_ICONS[element]}</span>
                        <h4
                          className="font-bold text-sm"
                          style={{ color: ELEMENT_COLORS[element] }}
                        >
                          {ELEMENT_NAMES[element]}元素
                        </h4>
                        <span className="text-xs text-gray-500 ml-auto">
                          背包 {inv.length} 件
                        </span>
                      </div>

                      <div className="flex gap-2 mb-3">
                        {equippedItems.map((item, index) => {
                          if (item) {
                            return (
                              <div key={`eq-${index}`} className="flex-1 min-w-0">
                                <EquipmentCard
                                  equipment={item}
                                  compact
                                  onUnequip={() => handleUnequipRune(element, index)}
                                />
                              </div>
                            );
                          }
                          return (
                            <div
                              key={`empty-${index}`}
                              className="flex-1 min-h-[80px] rounded-lg border-2 border-dashed border-gray-600/40 flex items-center justify-center relative group"
                            >
                              <span className="text-gray-600 text-2xl">⊘</span>
                              {inv.length > 0 && (
                                <div className="absolute inset-0 bg-game-bg-dark/95 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity overflow-auto z-10 p-2 max-h-48">
                                  <div className="space-y-1">
                                    {inv.map((invItem) => {
                                      const isEquippedInOtherSlot = equippedItems.some(
                                        (ei) => ei?.id === invItem.id
                                      );
                                      if (isEquippedInOtherSlot) return null;
                                      return (
                                        <button
                                          key={invItem.id}
                                          onClick={() =>
                                            handleEquipRune(element, index, invItem.id)
                                          }
                                          className={`w-full text-left p-2 rounded-lg text-xs border ${QUALITY_BG[invItem.quality]} hover:brightness-125 transition-all`}
                                        >
                                          <div className="flex items-center gap-1">
                                            <span
                                              style={{ color: QUALITY_COLORS[invItem.quality] }}
                                              className="font-bold"
                                            >
                                              {QUALITY_NAMES[invItem.quality]}
                                            </span>
                                            {invItem.level > 1 && (
                                              <span className="text-game-gold">
                                                Lv.{invItem.level}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {invItem.affixes.map((a, ai) => (
                                              <span
                                                key={ai}
                                                className="text-gray-400 text-[10px]"
                                              >
                                                {AFFIX_ICONS[a.type]}
                                                {AFFIX_FORMAT[a.type](a.value)}
                                              </span>
                                            ))}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {hasAny && (
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                          {equippedItems
                            .filter((i): i is RuneEquipment => i !== null)
                            .flatMap((item) =>
                              item.affixes.map((a) => (
                                <span key={`${item.id}-${a.type}`}>
                                  {AFFIX_ICONS[a.type]} {AFFIX_NAMES[a.type]}
                                  <span
                                    className="ml-0.5 font-bold"
                                    style={{ color: QUALITY_COLORS[item.quality] }}
                                  >
                                    {AFFIX_FORMAT[a.type](a.value)}
                                  </span>
                                </span>
                              ))
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="game-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={20} className="text-game-gold" />
                <h3 className="text-lg font-bold text-game-gold font-display">出战法术</h3>
                <span className="ml-auto text-xs text-gray-500">
                  已选 {activeLoadout.selectedSpellIds.length}/{MAX_SPELLS}
                </span>
              </div>

              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-2">已选择的法术</div>
                <div className="grid grid-cols-2 gap-3">
                  {getSelectedSpells().length === 0 && (
                    <div className="col-span-2 text-center text-gray-600 text-sm py-4 bg-game-bg-dark/40 rounded-lg">
                      请从下方选择最多 {MAX_SPELLS} 个法术
                    </div>
                  )}
                  {getSelectedSpells().map((spell) => (
                    <button
                      key={spell.id}
                      onClick={() => handleDeselectSpell(spell.id)}
                      className={`relative p-3 rounded-xl border-2 transition-all text-left hover:brightness-125`}
                      style={{
                        borderColor: `${ELEMENT_COLORS[spell.element]}60`,
                        backgroundColor: `${ELEMENT_COLORS[spell.element]}15`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{spell.icon}</span>
                        <span
                          className="font-bold text-sm"
                          style={{ color: ELEMENT_COLORS[spell.element] }}
                        >
                          {spell.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mb-1">{spell.description}</div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-yellow-400">消耗 {spell.cost}</span>
                        {spell.damage > 0 && <span className="text-red-400">伤害 {spell.damage}</span>}
                        {spell.heal > 0 && <span className="text-green-400">治疗 {spell.heal}</span>}
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        <X size={12} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-2">可用法术</div>
                <div className="grid grid-cols-2 gap-3">
                  {getUnselectedSpells().map((spell) => (
                    <button
                      key={spell.id}
                      onClick={() => handleSelectSpell(spell.id)}
                      disabled={activeLoadout.selectedSpellIds.length >= MAX_SPELLS}
                      className={`p-3 rounded-xl border border-gray-600/40 bg-game-bg-dark/40 transition-all text-left hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{spell.icon}</span>
                        <span
                          className="font-bold text-sm"
                          style={{ color: ELEMENT_COLORS[spell.element] }}
                        >
                          {spell.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mb-1">{spell.description}</div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-yellow-400">消耗 {spell.cost}</span>
                        {spell.damage > 0 && <span className="text-red-400">伤害 {spell.damage}</span>}
                        {spell.heal > 0 && <span className="text-green-400">治疗 {spell.heal}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="game-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Brain size={20} className="text-game-gold" />
                <h3 className="text-lg font-bold text-game-gold font-display">AI行为倾向</h3>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {(Object.keys(DEFENDER_AI_STYLE_NAMES) as DefenderAIStyle[]).map((style) => {
                  const isActive = activeLoadout.aiStyle === style;
                  return (
                    <button
                      key={style}
                      onClick={() => handleSetAIStyle(style)}
                      className={`relative p-4 rounded-xl text-left transition-all border-2 ${
                        isActive
                          ? 'bg-game-gold/10'
                          : 'bg-game-bg-dark/40 border-gray-600/40 hover:border-gray-500/60'
                      }`}
                      style={{
                        borderColor: isActive ? `${AI_STYLE_COLORS[style]}80` : undefined,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive ? '' : 'opacity-70'
                          }`}
                          style={{
                            backgroundColor: `${AI_STYLE_COLORS[style]}20`,
                            color: AI_STYLE_COLORS[style],
                          }}
                        >
                          {AI_STYLE_ICONS[style]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-bold mb-1"
                            style={{
                              color: isActive ? AI_STYLE_COLORS[style] : undefined,
                            }}
                          >
                            {DEFENDER_AI_STYLE_NAMES[style]}
                          </div>
                          <div className="text-xs text-gray-400 leading-relaxed">
                            {DEFENDER_AI_STYLE_DESC[style]}
                          </div>
                        </div>
                        {isActive && (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: AI_STYLE_COLORS[style],
                            }}
                          >
                            <Check size={14} className="text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="game-card p-5">
              <button
                onClick={() => setShowAdvancedAI(!showAdvancedAI)}
                className="w-full flex items-center gap-2 mb-0"
              >
                <Settings size={20} className="text-game-gold" />
                <h3 className="text-lg font-bold text-game-gold font-display">AI高级配置</h3>
                <span className="ml-auto text-gray-500">
                  {showAdvancedAI ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </span>
              </button>

              {showAdvancedAI && (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-300 flex items-center gap-1.5">
                        <Zap size={14} className="text-orange-400" />
                        蓄力伤害倍率
                      </label>
                      <span className="text-sm font-bold text-orange-400">
                        x{currentAIConfig.chargeDamageMultiplier.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.5"
                      max="4"
                      step="0.1"
                      value={currentAIConfig.chargeDamageMultiplier}
                      onChange={(e) =>
                        handleUpdateAIConfig('chargeDamageMultiplier', parseFloat(e.target.value))
                      }
                      className="w-full accent-orange-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>1.5x</span>
                      <span>4x</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-300 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-blue-400" />
                        防御减伤比例
                      </label>
                      <span className="text-sm font-bold text-blue-400">
                        {Math.round(currentAIConfig.defendDamageReduction * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="0.8"
                      step="0.05"
                      value={currentAIConfig.defendDamageReduction}
                      onChange={(e) =>
                        handleUpdateAIConfig('defendDamageReduction', parseFloat(e.target.value))
                      }
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>20%</span>
                      <span>80%</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-300 flex items-center gap-1.5">
                        <Skull size={14} className="text-purple-400" />
                        召唤冷却回合
                      </label>
                      <span className="text-sm font-bold text-purple-400">
                        {currentAIConfig.summonCooldown} 回合
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="8"
                      step="1"
                      value={currentAIConfig.summonCooldown}
                      onChange={(e) =>
                        handleUpdateAIConfig('summonCooldown', parseInt(e.target.value))
                      }
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>2</span>
                      <span>8</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-300 flex items-center gap-1.5">
                        <Flame size={14} className="text-red-400" />
                        狂暴触发阈值（血量%）
                      </label>
                      <span className="text-sm font-bold text-red-400">
                        {Math.round(currentAIConfig.berserkThreshold * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.6"
                      step="0.05"
                      value={currentAIConfig.berserkThreshold}
                      onChange={(e) =>
                        handleUpdateAIConfig('berserkThreshold', parseFloat(e.target.value))
                      }
                      className="w-full accent-red-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>10%</span>
                      <span>60%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="game-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Heart size={20} className="text-game-gold" />
                <h3 className="text-lg font-bold text-game-gold font-display">玩家血量设置</h3>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300">最大生命值</label>
                  <span className="text-sm font-bold text-red-400">
                    {activeLoadout.playerMaxHp} HP
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="500"
                  step="10"
                  value={activeLoadout.playerMaxHp}
                  onChange={(e) => handleSetPlayerMaxHp(parseInt(e.target.value))}
                  className="w-full accent-red-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>100</span>
                  <span>200 (默认)</span>
                  <span>500</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {[150, 200, 300].map((hp) => (
                  <button
                    key={hp}
                    onClick={() => handleSetPlayerMaxHp(hp)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeLoadout.playerMaxHp === hp
                        ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                        : 'bg-game-bg-dark/50 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {hp} HP
                  </button>
                ))}
              </div>
            </div>

            <div className="game-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Code size={20} className="text-game-gold" />
                <h3 className="text-lg font-bold text-game-gold font-display">对战码生成</h3>
              </div>

              <button
                onClick={handleGenerateBattleCode}
                className="w-full game-button-primary py-3 text-sm font-bold flex items-center justify-center gap-2 mb-4"
              >
                <Crown size={18} />
                生成防守对战码
              </button>

              {generatedCode && (
                <div className="bg-game-bg-dark rounded-xl p-4 border border-game-gold/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">你的对战码</span>
                    <button
                      onClick={handleCopyCode}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        copied
                          ? 'bg-green-500/30 text-green-300'
                          : 'bg-game-gold/20 text-game-gold hover:bg-game-gold/30'
                      }`}
                    >
                      {copied ? (
                        <>
                          <CheckCircle size={14} />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          复制
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-game-gold break-all leading-relaxed max-h-32 overflow-auto select-all">
                    {generatedCode}
                  </div>
                  <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
                    将此对战码分享给其他玩家，他们即可向你的防守阵容发起挑战
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

export default LoadoutConfigPage;
