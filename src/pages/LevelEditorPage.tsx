import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkshopStore } from '../store/useWorkshopStore';
import { BACKGROUNDS, DIFFICULTY_META } from '../types/workshop';
import type { EditorTool, TileType, TerrainType } from '../types';
import { deepValidateLevel } from '../utils/levelValidation';
import {
  ArrowLeft,
  Save,
  Play,
  Upload,
  RotateCcw,
  Square,
  Snowflake,
  Zap,
  Mountain,
  TreePine,
  CloudLightning,
  Eraser,
  MousePointer,
  Minus,
  Plus,
} from 'lucide-react';

const TOOLS: { id: EditorTool; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'select', label: '选择', icon: <MousePointer size={16} />, color: 'text-gray-300' },
  { id: 'obstacle', label: '障碍石', icon: <Square size={16} />, color: 'text-gray-400' },
  { id: 'frozen', label: '冰霜符文', icon: <Snowflake size={16} />, color: 'text-blue-400' },
  { id: 'double_energy', label: '双倍能量', icon: <Zap size={16} />, color: 'text-yellow-400' },
  { id: 'terrain_magma', label: '岩浆地形', icon: <Mountain size={16} />, color: 'text-orange-500' },
  { id: 'terrain_frost', label: '冰霜地形', icon: <Snowflake size={16} />, color: 'text-cyan-300' },
  { id: 'terrain_thorns', label: '荆棘地形', icon: <TreePine size={16} />, color: 'text-green-500' },
  { id: 'terrain_storm', label: '雷暴地形', icon: <CloudLightning size={16} />, color: 'text-purple-400' },
  { id: 'eraser', label: '橡皮擦', icon: <Eraser size={16} />, color: 'text-pink-400' },
];

const TILE_VISUALS: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  normal: { bg: 'bg-game-bg-dark', border: 'border-game-gold/20', icon: '', label: '' },
  obstacle: { bg: 'bg-gradient-to-br from-gray-600 to-gray-800', border: 'border-gray-500/60', icon: '🪨', label: '障碍' },
  frozen: { bg: 'bg-gradient-to-br from-blue-500/40 to-blue-300/20', border: 'border-blue-400/70', icon: '❄️', label: '冰霜' },
  double_energy: { bg: 'bg-gradient-to-br from-yellow-500/40 to-yellow-300/20', border: 'border-yellow-400/70', icon: '⚡', label: '双倍' },
};

const TERRAIN_VISUALS: Record<string, { bg: string; icon: string; label: string }> = {
  magma: { bg: 'bg-gradient-to-br from-orange-600/30 to-red-600/20', icon: '🌋', label: '岩浆' },
  frost: { bg: 'bg-gradient-to-br from-cyan-400/30 to-blue-400/20', icon: '❄️', label: '冰霜' },
  thorns: { bg: 'bg-gradient-to-br from-green-600/30 to-green-400/20', icon: '🌵', label: '荆棘' },
  storm: { bg: 'bg-gradient-to-br from-purple-500/30 to-purple-400/20', icon: '⛈️', label: '雷暴' },
};

export const LevelEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    editorState,
    updateEditorState,
    updateEditorCell,
    resetEditor,
    setEditorTool,
    setSelectedEnemy,
    buildLevelFromEditor,
    saveEditorDraft,
    uploadLevel,
    getEnemyPool,
  } = useWorkshopStore();

  const enemyPool = getEnemyPool();
  const [activeTab, setActiveTab] = useState<'grid' | 'enemy' | 'settings' | 'theme'>('grid');
  const [isPainting, setIsPainting] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      saveEditorDraft();
    }, 30000);
    return () => clearInterval(interval);
  }, [saveEditorDraft]);

  const ELEMENT_EMOJI: Record<string, string> = { fire: '🔥', water: '💧', grass: '🌿', thunder: '⚡' };

  const handleCellInteraction = useCallback(
    (row: number, col: number) => {
      const tool = editorState.selectedTool;
      if (tool === 'select') return;

      if (tool === 'eraser') {
        updateEditorCell(row, col, { tileType: 'normal' as TileType, terrainType: null });
        return;
      }

      if (tool.startsWith('terrain_')) {
        const terrainType = tool.replace('terrain_', '') as TerrainType;
        const cell = editorState.cells.find((c) => c.row === row && c.col === col);
        if (cell?.terrainType === terrainType) {
          updateEditorCell(row, col, { terrainType: null });
        } else {
          updateEditorCell(row, col, { terrainType });
        }
        return;
      }

      const tileType = tool as TileType;
      const cell = editorState.cells.find((c) => c.row === row && c.col === col);
      if (cell?.tileType === tileType) {
        updateEditorCell(row, col, { tileType: 'normal' as TileType });
      } else {
        updateEditorCell(row, col, { tileType });
      }
    },
    [editorState.selectedTool, editorState.cells, updateEditorCell]
  );

  const handleCellMouseDown = useCallback(
    (row: number, col: number) => {
      setIsPainting(true);
      handleCellInteraction(row, col);
    },
    [handleCellInteraction]
  );

  const handleCellMouseEnter = useCallback(
    (row: number, col: number) => {
      if (isPainting) handleCellInteraction(row, col);
    },
    [isPainting, handleCellInteraction]
  );

  const handleMouseUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const handleTrialPlay = () => {
    const level = buildLevelFromEditor();
    if (!level) return;
    saveEditorDraft();
    navigate(`/workshop/trial`, { state: { level, isEditor: true } });
  };

  const handleUpload = () => {
    const level = buildLevelFromEditor();
    if (!level) return;
    const validation = deepValidateLevel(level);
    setValidationResult(validation);
    if (validation.valid) {
      const result = uploadLevel(level);
      if (result.valid) {
        navigate('/workshop');
      }
    }
  };

  const handleValidate = () => {
    const level = buildLevelFromEditor();
    if (!level) {
      setValidationResult({ valid: false, errors: ['请先完成关卡配置（名称和敌人为必填）'], warnings: [] });
      return;
    }
    const validation = deepValidateLevel(level);
    setValidationResult(validation);
  };

  const getCellVisual = (cell: typeof editorState.cells[0]) => {
    const tile = TILE_VISUALS[cell.tileType] || TILE_VISUALS.normal;
    const terrain = cell.terrainType ? TERRAIN_VISUALS[cell.terrainType] : null;
    return { tile, terrain };
  };

  const selectedEnemy = editorState.selectedEnemyId
    ? enemyPool.find((e) => e.id === editorState.selectedEnemyId)
    : null;

  const obstacleCount = editorState.cells.filter((c) => c.tileType === 'obstacle').length;
  const frozenCount = editorState.cells.filter((c) => c.tileType === 'frozen').length;
  const doubleEnergyCount = editorState.cells.filter((c) => c.tileType === 'double_energy').length;
  const totalCells = editorState.gridSize * editorState.gridSize;
  const terrainCounts: Record<string, number> = {
    magma: editorState.cells.filter((c) => c.terrainType === 'magma').length,
    frost: editorState.cells.filter((c) => c.terrainType === 'frost').length,
    thorns: editorState.cells.filter((c) => c.terrainType === 'thorns').length,
    storm: editorState.cells.filter((c) => c.terrainType === 'storm').length,
  };

  return (
    <div className="min-h-screen w-full overflow-auto p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/workshop')}
              className="game-button-secondary flex items-center gap-2 px-4 py-2"
            >
              <ArrowLeft size={18} />
              <span>返回工坊</span>
            </button>
            <h1 className="text-3xl font-bold text-game-gold font-display">
              关卡编辑器
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { resetEditor(); setValidationResult(null); }}
              className="game-button-secondary flex items-center gap-2 px-3 py-2 text-red-400 border-red-400/30 hover:bg-red-500/20"
            >
              <RotateCcw size={16} />
              <span className="hidden md:inline">重置</span>
            </button>
            <button
              onClick={handleValidate}
              className="game-button-secondary flex items-center gap-2 px-3 py-2 text-blue-400 border-blue-400/30 hover:bg-blue-500/20"
            >
              <Save size={16} />
              <span className="hidden md:inline">验证</span>
            </button>
            <button
              onClick={handleTrialPlay}
              disabled={!editorState.levelName || !editorState.selectedEnemyId}
              className="game-button-secondary flex items-center gap-2 px-4 py-2 text-green-400 border-green-400/30 hover:bg-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={16} />
              <span>试玩</span>
            </button>
            <button
              onClick={() => setShowUploadConfirm(true)}
              disabled={!editorState.levelName || !editorState.selectedEnemyId}
              className="game-button-primary flex items-center gap-2 px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              <span>上传</span>
            </button>
          </div>
        </div>

        {validationResult && (
          <div className={`mb-4 p-4 rounded-lg border ${validationResult.valid ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {validationResult.errors.length > 0 && (
              <div className="mb-2">
                {validationResult.errors.map((e, i) => (
                  <p key={i} className="text-red-400 text-sm">❌ {e}</p>
                ))}
              </div>
            )}
            {validationResult.warnings.length > 0 && (
              <div>
                {validationResult.warnings.map((w, i) => (
                  <p key={i} className="text-yellow-400 text-sm">⚠️ {w}</p>
                ))}
              </div>
            )}
            {validationResult.valid && validationResult.warnings.length === 0 && (
              <p className="text-green-400 text-sm">✅ 关卡配置有效，可以上传！</p>
            )}
            <button
              onClick={() => setValidationResult(null)}
              className="mt-2 text-gray-400 text-xs hover:text-gray-300"
            >
              关闭
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="game-card p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="text"
                  value={editorState.levelName}
                  onChange={(e) => updateEditorState({ levelName: e.target.value })}
                  placeholder="输入关卡名称..."
                  className="flex-1 bg-game-bg-dark border border-game-gold/30 rounded-lg px-4 py-2 text-game-gold placeholder-gray-500 focus:outline-none focus:border-game-gold"
                  maxLength={50}
                />
                <span className="text-gray-500 text-sm">{editorState.levelName.length}/50</span>
              </div>
              <textarea
                value={editorState.levelDescription}
                onChange={(e) => updateEditorState({ levelDescription: e.target.value })}
                placeholder="输入关卡描述..."
                className="w-full bg-game-bg-dark border border-game-gold/30 rounded-lg px-4 py-2 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-game-gold resize-none h-20"
                maxLength={500}
              />
              <div className="flex justify-between mt-1">
                <span className="text-gray-500 text-xs">{editorState.levelDescription.length}/500</span>
                <div className="flex gap-2 text-xs text-gray-400">
                  <span>障碍: {obstacleCount}</span>
                  <span>冰霜: {frozenCount}</span>
                  <span>双倍: {doubleEnergyCount}</span>
                  <span>|</span>
                  {Object.entries(terrainCounts).map(([k, v]) => (
                    <span key={k}>{TERRAIN_VISUALS[k]?.icon} {v}</span>
                  ))}
                </div>
              </div>

              {editorState.trialRecord && (
                <div className={`mt-3 p-3 rounded-lg border ${editorState.trialRecord.completed ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {editorState.trialRecord.completed ? (
                        <>
                          <span className="text-green-400">✅</span>
                          <span className="text-green-400 text-sm font-medium">试玩验证通过</span>
                        </>
                      ) : (
                        <>
                          <span className="text-red-400">❌</span>
                          <span className="text-red-400 text-sm font-medium">试玩未通过</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(editorState.trialRecord.recordedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>回合数: <span className="text-game-gold">{editorState.trialRecord.turnsTaken}</span></span>
                    <span>剩余生命: <span className="text-green-400">{editorState.trialRecord.playerHpRemaining}</span></span>
                    <span>操作记录: <span className="text-gray-300">{editorState.trialRecord.actions.length} 条</span></span>
                  </div>
                </div>
              )}
            </div>

            <div className="game-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1">
                  {TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => setEditorTool(tool.id)}
                      className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs transition-all ${
                        editorState.selectedTool === tool.id
                          ? 'bg-game-gold/20 border border-game-gold/50 text-game-gold'
                          : 'hover:bg-game-card-hover text-gray-400'
                      }`}
                    >
                      {tool.icon}
                      <span className="hidden xl:inline">{tool.label}</span>
                    </button>
                  ))}
                </div>
                <div className="text-xs text-gray-500">
                  {TOOLS.find((t) => t.id === editorState.selectedTool)?.label}
                </div>
              </div>

              <div
                className="grid gap-1 mx-auto"
                style={{
                  gridTemplateColumns: `repeat(${editorState.gridSize}, 1fr)`,
                  maxWidth: `${editorState.gridSize * 64 + (editorState.gridSize - 1) * 4}px`,
                }}
              >
                {editorState.cells.map((cell) => {
                  const { tile, terrain } = getCellVisual(cell);
                  return (
                    <div
                      key={`${cell.row}-${cell.col}`}
                      className={`aspect-square rounded-md border-2 cursor-pointer transition-all duration-150 flex flex-col items-center justify-center relative select-none ${tile.bg} ${tile.border} ${
                        terrain ? terrain.bg : ''
                      } ${editorState.selectedTool === 'select' ? 'cursor-default' : 'hover:brightness-125'}`}
                      onMouseDown={() => handleCellMouseDown(cell.row, cell.col)}
                      onMouseEnter={() => handleCellMouseEnter(cell.row, cell.col)}
                    >
                      {tile.icon && <span className="text-sm leading-none">{tile.icon}</span>}
                      {terrain && (
                        <span className="absolute bottom-0 right-0.5 text-[10px] leading-none opacity-80">
                          {terrain.icon}
                        </span>
                      )}
                      {cell.tileType === 'normal' && !cell.terrainType && (
                        <span className="text-[10px] text-gray-600">
                          {cell.row},{cell.col}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-80 space-y-4">
            <div className="flex gap-1 bg-game-card rounded-lg p-1">
              {(['grid', 'enemy', 'settings', 'theme'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-game-gold/20 text-game-gold'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {{
                    grid: '棋盘',
                    enemy: '敌人',
                    settings: '设置',
                    theme: '主题',
                  }[tab]}
                </button>
              ))}
            </div>

            {activeTab === 'grid' && (
              <div className="game-card p-4 space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">棋盘尺寸: {editorState.gridSize}×{editorState.gridSize}</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateEditorState({ gridSize: Math.max(4, editorState.gridSize - 1) })}
                      className="w-8 h-8 rounded-lg bg-game-bg-dark border border-game-gold/30 flex items-center justify-center text-game-gold hover:bg-game-gold/20"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="flex-1 h-2 bg-game-bg-dark rounded-full overflow-hidden">
                      <div
                        className="h-full bg-game-gold/50 rounded-full transition-all"
                        style={{ width: `${((editorState.gridSize - 4) / 4) * 100}%` }}
                      />
                    </div>
                    <button
                      onClick={() => updateEditorState({ gridSize: Math.min(8, editorState.gridSize + 1) })}
                      className="w-8 h-8 rounded-lg bg-game-bg-dark border border-game-gold/30 flex items-center justify-center text-game-gold hover:bg-game-gold/20"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">范围: 4×4 ~ 8×8，当前: {totalCells} 格</p>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">能量上限: {editorState.maxEnergy}</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateEditorState({ maxEnergy: Math.max(5, editorState.maxEnergy - 1) })}
                      className="w-8 h-8 rounded-lg bg-game-bg-dark border border-game-gold/30 flex items-center justify-center text-game-gold hover:bg-game-gold/20"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="flex-1 h-2 bg-game-bg-dark rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500/50 rounded-full transition-all"
                        style={{ width: `${((editorState.maxEnergy - 5) / 25) * 100}%` }}
                      />
                    </div>
                    <button
                      onClick={() => updateEditorState({ maxEnergy: Math.min(30, editorState.maxEnergy + 1) })}
                      className="w-8 h-8 rounded-lg bg-game-bg-dark border border-game-gold/30 flex items-center justify-center text-game-gold hover:bg-game-gold/20"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">玩家生命: {editorState.playerMaxHp}</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateEditorState({ playerMaxHp: Math.max(50, editorState.playerMaxHp - 10) })}
                      className="w-8 h-8 rounded-lg bg-game-bg-dark border border-game-gold/30 flex items-center justify-center text-game-gold hover:bg-game-gold/20"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="flex-1 h-2 bg-game-bg-dark rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/50 rounded-full transition-all"
                        style={{ width: `${((editorState.playerMaxHp - 50) / 450) * 100}%` }}
                      />
                    </div>
                    <button
                      onClick={() => updateEditorState({ playerMaxHp: Math.min(500, editorState.playerMaxHp + 10) })}
                      className="w-8 h-8 rounded-lg bg-game-bg-dark border border-game-gold/30 flex items-center justify-center text-game-gold hover:bg-game-gold/20"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block">星级评价阈值（回合数）</label>
                  <div className="flex gap-2">
                    {editorState.stars.map((star, i) => (
                      <div key={i} className="flex-1">
                        <div className="flex items-center gap-1 mb-1">
                          {['⭐', '🌟', '💫'][i]}
                          <span className="text-xs text-gray-500">{i + 1}星</span>
                        </div>
                        <input
                          type="number"
                          value={star}
                          onChange={(e) => {
                            const newStars = [...editorState.stars];
                            newStars[i] = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                            updateEditorState({ stars: newStars });
                          }}
                          className="w-full bg-game-bg-dark border border-game-gold/30 rounded px-2 py-1 text-sm text-center text-game-gold focus:outline-none focus:border-game-gold"
                          min={1}
                          max={100}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'enemy' && (
              <div className="game-card p-4 space-y-3">
                <h3 className="text-sm text-gray-400 font-medium">选择敌人（从预设池）</h3>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {enemyPool.map((enemy) => {
                    const isSelected = editorState.selectedEnemyId === enemy.id;
                    const diff = DIFFICULTY_META[enemy.difficulty as keyof typeof DIFFICULTY_META];
                    return (
                      <button
                        key={enemy.id}
                        onClick={() => setSelectedEnemy(enemy.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-game-gold/15 border-game-gold/50 ring-1 ring-game-gold/30'
                            : 'bg-game-bg-dark border-game-gold/10 hover:border-game-gold/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{enemy.sprite}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-200 truncate">{enemy.name}</span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ color: diff.color, backgroundColor: diff.color + '20' }}
                              >
                                {diff.name}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{enemy.description}</p>
                            <div className="flex gap-3 mt-1 text-xs text-gray-400">
                              <span>❤️ {enemy.maxHp}</span>
                              <span>⚔️ {enemy.attack}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedEnemy && (
                  <div className="mt-3 p-3 bg-game-bg-dark rounded-lg border border-game-gold/20">
                    <h4 className="text-sm font-medium text-game-gold mb-2">
                      {selectedEnemy.sprite} {selectedEnemy.name} 详细属性
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                      <span>生命: {selectedEnemy.maxHp}</span>
                      <span>攻击: {selectedEnemy.attack}</span>
                      <span>攻击模式: [{selectedEnemy.attackPattern.join(', ')}]</span>
                      <span>AI策略: {selectedEnemy.aiConfig.priority}</span>
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {Object.entries(selectedEnemy.resistance).map(([el, val]) => (
                        <span
                          key={el}
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            (val as number) > 0
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}
                        >
                          {ELEMENT_EMOJI[el as string]}{' '}
                          {(val as number) > 0 ? `抗性${Math.round((val as number) * 100)}%` : `弱点${Math.round(Math.abs(val as number) * 100)}%`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="game-card p-4 space-y-4">
                <h3 className="text-sm text-gray-400 font-medium">关卡配置</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">棋盘尺寸</label>
                    <p className="text-game-gold font-medium">{editorState.gridSize}×{editorState.gridSize} ({totalCells} 格)</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">能量上限</label>
                    <p className="text-game-gold font-medium">{editorState.maxEnergy}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">玩家生命值</label>
                    <p className="text-game-gold font-medium">{editorState.playerMaxHp}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">选中敌人</label>
                    <p className="text-game-gold font-medium">
                      {selectedEnemy ? `${selectedEnemy.sprite} ${selectedEnemy.name}` : '未选择'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">特殊方块统计</label>
                    <div className="flex gap-3 text-sm">
                      <span className="text-gray-300">🪨 障碍: {obstacleCount}</span>
                      <span className="text-blue-300">❄️ 冰霜: {frozenCount}</span>
                      <span className="text-yellow-300">⚡ 双倍: {doubleEnergyCount}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">地形统计</label>
                    <div className="flex gap-3 text-sm flex-wrap">
                      <span className="text-orange-300">🌋 岩浆: {terrainCounts.magma}</span>
                      <span className="text-cyan-300">❄️ 冰霜: {terrainCounts.frost}</span>
                      <span className="text-green-300">🌵 荆棘: {terrainCounts.thorns}</span>
                      <span className="text-purple-300">⛈️ 雷暴: {terrainCounts.storm}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">难度预估</label>
                    {selectedEnemy ? (
                      <span
                        className="text-sm font-medium"
                        style={{ color: DIFFICULTY_META[selectedEnemy.difficulty as keyof typeof DIFFICULTY_META]?.color || '#9ca3af' }}
                      >
                        {DIFFICULTY_META[selectedEnemy.difficulty as keyof typeof DIFFICULTY_META]?.name || '未知'}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">选择敌人后显示</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="game-card p-4 space-y-3">
                <h3 className="text-sm text-gray-400 font-medium">选择背景主题</h3>
                <div className="grid grid-cols-2 gap-2">
                  {BACKGROUNDS.map((bg) => {
                    const isSelected = editorState.backgroundTheme === bg.id;
                    return (
                      <button
                        key={bg.id}
                        onClick={() => updateEditorState({ backgroundTheme: bg.id })}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-game-gold bg-game-gold/10'
                            : 'border-game-gold/10 bg-game-bg-dark hover:border-game-gold/30'
                        }`}
                      >
                        <div
                          className="w-full h-12 rounded-md mb-2 flex items-center justify-center text-2xl"
                          style={{ backgroundColor: bg.color + '30', border: `1px solid ${bg.color}50` }}
                        >
                          {bg.icon}
                        </div>
                        <span className="text-sm text-gray-300">{bg.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showUploadConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="game-card p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-game-gold mb-4">上传关卡确认</h2>
            <div className="space-y-3 mb-6">
              <p className="text-gray-300">确认上传此关卡到创意工坊？</p>
              <div className="bg-game-bg-dark rounded-lg p-3 text-sm">
                <p className="text-game-gold font-medium">{editorState.levelName || '未命名关卡'}</p>
                <p className="text-gray-400 mt-1">{editorState.levelDescription || '无描述'}</p>
                <div className="flex gap-3 mt-2 text-xs text-gray-500">
                  <span>{editorState.gridSize}×{editorState.gridSize}</span>
                  <span>敌人: {selectedEnemy?.name || '未选择'}</span>
                  <span>背景: {BACKGROUNDS.find((b) => b.id === editorState.backgroundTheme)?.name}</span>
                </div>
              </div>
              <p className="text-yellow-400 text-xs">💡 上传前建议先进行试玩验证，确保关卡可通关</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUploadConfirm(false)}
                className="flex-1 game-button-secondary py-2"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowUploadConfirm(false);
                  handleUpload();
                }}
                className="flex-1 game-button-primary py-2"
              >
                确认上传
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
