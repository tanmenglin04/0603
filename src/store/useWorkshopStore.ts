import { create } from 'zustand';
import type {
  WorkshopLevel,
  WorkshopComment,
  WorkshopSortType,
  WorkshopCategory,
  EditorState,
  EditorCell,
  EditorTool,
  TrialRecord,
  LevelSerialization,
  WorkshopTerrainConfig,
} from '../types/workshop';
import type { TileType, TerrainType, ElementType, EnemyAIConfig } from '../types';
import {
  validateWorkshopLevel,
  serializeLevel,
  deserializeLevel,
  createLevelSerialization,
  verifyLevelSerialization,
  calculateDifficulty,
  sanitizeString,
  validateNumber,
  deepValidateLevel,
  safeDeserializeLevel,
  createSecureLevelSerialization,
} from '../utils/levelValidation';
import { WORKSHOP_VERSION, BACKGROUNDS, DIFFICULTY_META } from '../types/workshop';
import enemyPoolData from '../data/enemyPool.json';

const STORAGE_KEY = 'workshop_data';
const EDITOR_KEY = 'workshop_editor';

interface WorkshopEnemyPoolItem {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  resistance: Partial<Record<ElementType, number>>;
  attackPattern: number[];
  sprite: string;
  description: string;
  difficulty: string;
  aiConfig: EnemyAIConfig;
}

const enemyPool: WorkshopEnemyPoolItem[] = enemyPoolData as WorkshopEnemyPoolItem[];

const OFFICIAL_LEVELS: WorkshopLevel[] = [
  {
    id: 'official_1',
    name: '熔岩试炼',
    description: '在滚烫的熔岩中击退火焰精灵的挑战，小心岩浆的蔓延！',
    authorId: 'system',
    authorName: '官方',
    background: 'volcano',
    enemy: {
      id: 'fire_sprite',
      name: '火焰精灵',
      maxHp: 100,
      attack: 12,
      resistance: { fire: 0.5, water: -0.2 },
      attackPattern: [10, 12, 15, 12, 10],
      sprite: '🔥',
      description: '火焰的化身',
      aiConfig: enemyPool[1].aiConfig,
    },
    playerMaxHp: 150,
    maxEnergy: 10,
    gridSize: 6,
    stars: [100, 70, 40],
    specialTiles: { obstacle: 3, frozen: 0, doubleEnergy: 2, doubleEnergyDuration: 3 },
    terrain: { magma: 4, frost: 0, thorns: 0, storm: 0, magmaSpreadChance: 0.3 },
    tilePlacements: [
      { row: 1, col: 1, tileType: 'obstacle' as TileType, terrainType: null },
      { row: 2, col: 4, tileType: 'obstacle' as TileType, terrainType: null },
      { row: 4, col: 2, tileType: 'obstacle' as TileType, terrainType: null },
      { row: 0, col: 3, tileType: 'double_energy' as TileType, terrainType: null },
      { row: 5, col: 5, tileType: 'double_energy' as TileType, terrainType: null },
      { row: 1, col: 0, tileType: 'normal' as TileType, terrainType: 'magma' as TerrainType },
      { row: 3, col: 3, tileType: 'normal' as TileType, terrainType: 'magma' as TerrainType },
      { row: 5, col: 0, tileType: 'normal' as TileType, terrainType: 'magma' as TerrainType },
      { row: 0, col: 5, tileType: 'normal' as TileType, terrainType: 'magma' as TerrainType },
    ],
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
    plays: 1250,
    clears: 780,
    likes: 420,
    dislikes: 35,
    averageRating: 4.2,
    ratingCount: 380,
    isOfficial: true,
    isFeatured: true,
    difficulty: 'easy',
    tags: ['火山', '岩浆', '入门'],
    trialRecord: null,
  },
  {
    id: 'official_2',
    name: '冰霜迷宫',
    description: '冰霜法师布下了冰冻陷阱，在极寒中找到突破口！',
    authorId: 'system',
    authorName: '官方',
    background: 'snow',
    enemy: {
      id: 'frost_mage',
      name: '冰霜法师',
      maxHp: 160,
      attack: 20,
      resistance: { water: 0.4, fire: -0.2 },
      attackPattern: [15, 18, 22, 25, 22, 18],
      sprite: '🧙‍♂️',
      description: '掌握冰霜魔法的法师',
      aiConfig: enemyPool[7].aiConfig,
    },
    playerMaxHp: 200,
    maxEnergy: 12,
    gridSize: 6,
    stars: [120, 80, 45],
    specialTiles: { obstacle: 4, frozen: 5, doubleEnergy: 1, doubleEnergyDuration: 3 },
    terrain: { magma: 0, frost: 6, thorns: 0, storm: 0 },
    tilePlacements: [
      { row: 0, col: 0, tileType: 'frozen' as TileType, terrainType: null },
      { row: 1, col: 2, tileType: 'frozen' as TileType, terrainType: null },
      { row: 3, col: 4, tileType: 'frozen' as TileType, terrainType: null },
      { row: 5, col: 1, tileType: 'frozen' as TileType, terrainType: null },
      { row: 4, col: 5, tileType: 'frozen' as TileType, terrainType: null },
      { row: 2, col: 1, tileType: 'obstacle' as TileType, terrainType: null },
      { row: 2, col: 4, tileType: 'obstacle' as TileType, terrainType: null },
      { row: 4, col: 0, tileType: 'obstacle' as TileType, terrainType: null },
      { row: 0, col: 5, tileType: 'obstacle' as TileType, terrainType: null },
      { row: 3, col: 3, tileType: 'double_energy' as TileType, terrainType: null },
      { row: 0, col: 2, tileType: 'normal' as TileType, terrainType: 'frost' as TerrainType },
      { row: 1, col: 5, tileType: 'normal' as TileType, terrainType: 'frost' as TerrainType },
      { row: 3, col: 0, tileType: 'normal' as TileType, terrainType: 'frost' as TerrainType },
      { row: 4, col: 3, tileType: 'normal' as TileType, terrainType: 'frost' as TerrainType },
      { row: 5, col: 4, tileType: 'normal' as TileType, terrainType: 'frost' as TerrainType },
      { row: 2, col: 2, tileType: 'normal' as TileType, terrainType: 'frost' as TerrainType },
    ],
    createdAt: Date.now() - 86400000 * 25,
    updatedAt: Date.now() - 86400000 * 25,
    plays: 980,
    clears: 450,
    likes: 310,
    dislikes: 42,
    averageRating: 3.8,
    ratingCount: 290,
    isOfficial: true,
    isFeatured: true,
    difficulty: 'hard',
    tags: ['冰霜', '迷宫', '挑战'],
    trialRecord: null,
  },
  {
    id: 'official_3',
    name: '深渊之龙',
    description: '远古巨龙从深渊苏醒，只有最强的勇者才能在此生存！',
    authorId: 'system',
    authorName: '官方',
    background: 'cave',
    enemy: {
      id: 'ancient_dragon',
      name: '远古巨龙',
      maxHp: 350,
      attack: 25,
      resistance: { fire: 0.5, water: 0.2, grass: 0.2, thunder: 0.2 },
      attackPattern: [20, 25, 30, 35, 30, 25, 20],
      sprite: '🐉',
      description: '沉睡千年的远古巨龙',
      aiConfig: enemyPool[9].aiConfig,
    },
    playerMaxHp: 300,
    maxEnergy: 15,
    gridSize: 7,
    stars: [150, 100, 50],
    specialTiles: { obstacle: 6, frozen: 3, doubleEnergy: 3, doubleEnergyDuration: 3 },
    terrain: { magma: 3, frost: 2, thorns: 3, storm: 2 },
    tilePlacements: [],
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 20,
    plays: 2100,
    clears: 320,
    likes: 580,
    dislikes: 90,
    averageRating: 4.5,
    ratingCount: 520,
    isOfficial: true,
    isFeatured: true,
    difficulty: 'extreme',
    tags: ['巨龙', '极难', 'BOSS'],
    trialRecord: null,
  },
];

const defaultEditorState = (): EditorState => ({
  gridSize: 6,
  cells: Array.from({ length: 36 }, (_, i) => ({
    row: Math.floor(i / 6),
    col: i % 6,
    tileType: 'normal' as TileType,
    terrainType: null,
  })),
  selectedTool: 'select' as EditorTool,
  levelName: '',
  levelDescription: '',
  backgroundTheme: 'forest',
  playerMaxHp: 150,
  maxEnergy: 10,
  stars: [100, 70, 40],
  selectedEnemyId: null,
  customEnemyConfig: null,
  trialRecord: null,
});

interface WorkshopStoreState {
  levels: WorkshopLevel[];
  comments: Record<string, WorkshopComment[]>;
  editorState: EditorState;
  sortType: WorkshopSortType;
  category: WorkshopCategory;
  searchQuery: string;
  userRatings: Record<string, number>;
  isLoading: boolean;
}

interface WorkshopStoreActions {
  load: () => void;
  save: () => void;
  setSortType: (sort: WorkshopSortType) => void;
  setCategory: (cat: WorkshopCategory) => void;
  setSearchQuery: (q: string) => void;
  getFilteredLevels: () => WorkshopLevel[];
  getLevelById: (id: string) => WorkshopLevel | undefined;
  getComments: (levelId: string) => WorkshopComment[];
  addComment: (levelId: string, content: string, rating: number) => void;
  likeComment: (commentId: string) => void;
  rateLevel: (levelId: string, rating: number) => void;
  playLevel: (levelId: string) => void;
  recordClear: (levelId: string) => void;
  likeLevel: (levelId: string) => void;
  dislikeLevel: (levelId: string) => void;
  uploadLevel: (level: WorkshopLevel) => ValidationResult;
  deleteLevel: (levelId: string) => void;
  toggleFeatured: (levelId: string) => void;
  updateEditorState: (updates: Partial<EditorState>) => void;
  updateEditorCell: (row: number, col: number, updates: Partial<EditorCell>) => void;
  resetEditor: () => void;
  setEditorTool: (tool: EditorTool) => void;
  setSelectedEnemy: (enemyId: string | null) => void;
  setTrialRecord: (record: TrialRecord) => void;
  buildLevelFromEditor: () => WorkshopLevel | null;
  saveEditorDraft: () => void;
  loadEditorDraft: () => void;
  getEnemyPool: () => WorkshopEnemyPoolItem[];
  validateAndSerialize: (level: WorkshopLevel) => { serialized: LevelSerialization | null; validation: ValidationResult };
  verifyIntegrity: (serialized: any) => boolean;
}

export const useWorkshopStore = create<WorkshopStoreState & WorkshopStoreActions>((set, get) => ({
  levels: [...OFFICIAL_LEVELS],
  comments: {},
  editorState: defaultEditorState(),
  sortType: 'hot',
  category: 'all',
  searchQuery: '',
  userRatings: {},
  isLoading: false,

  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const userLevels: WorkshopLevel[] = (data.levels || [])
          .map((l: any) => safeDeserializeLevel(JSON.stringify(l)))
          .filter(Boolean) as WorkshopLevel[];
        set({
          levels: [...OFFICIAL_LEVELS, ...userLevels],
          comments: data.comments || {},
          userRatings: data.userRatings || {},
        });
      }
      const draftRaw = localStorage.getItem(EDITOR_KEY);
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw);
          if (draft.trialRecord && typeof draft.trialRecord !== 'object') {
            draft.trialRecord = null;
          }
          set({ editorState: { ...defaultEditorState(), ...draft } });
        } catch {
          set({ editorState: defaultEditorState() });
        }
      }
    } catch {}
  },

  save: () => {
    try {
      const { levels, comments, userRatings } = get();
      const userLevels = levels.filter((l) => !l.isOfficial);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ levels: userLevels, comments, userRatings }));
    } catch {}
  },

  setSortType: (sort) => set({ sortType: sort }),
  setCategory: (cat) => set({ category: cat }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  getFilteredLevels: () => {
    const { levels, sortType, category, searchQuery } = get();
    let filtered = [...levels];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.authorName.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    switch (category) {
      case 'official':
        filtered = filtered.filter((l) => l.isOfficial || l.isFeatured);
        break;
      case 'easy':
        filtered = filtered.filter((l) => l.difficulty === 'easy');
        break;
      case 'medium':
        filtered = filtered.filter((l) => l.difficulty === 'medium');
        break;
      case 'hard':
        filtered = filtered.filter((l) => l.difficulty === 'hard');
        break;
      case 'extreme':
        filtered = filtered.filter((l) => l.difficulty === 'extreme');
        break;
    }

    switch (sortType) {
      case 'hot':
        filtered.sort((a, b) => b.plays - a.plays);
        break;
      case 'clear_rate':
        filtered.sort((a, b) => (b.clears / Math.max(b.plays, 1)) - (a.clears / Math.max(a.plays, 1)));
        break;
      case 'newest':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'rating':
        filtered.sort((a, b) => b.averageRating - a.averageRating);
        break;
    }

    const featured = filtered.filter((l) => l.isFeatured);
    const regular = filtered.filter((l) => !l.isFeatured);
    return [...featured, ...regular];
  },

  getLevelById: (id) => get().levels.find((l) => l.id === id),

  getComments: (levelId) => get().comments[levelId] || [],

  addComment: (levelId, content, rating) => {
    const { comments } = get();
    const newComment: WorkshopComment = {
      id: 'cmt_' + Math.random().toString(36).substring(2, 11),
      levelId,
      authorId: 'local_user',
      authorName: '玩家',
      content: sanitizeString(content, 500),
      rating,
      createdAt: Date.now(),
      likes: 0,
      isOfficial: false,
    };
    const updated = {
      ...comments,
      [levelId]: [...(comments[levelId] || []), newComment],
    };
    set({ comments: updated });
    get().save();
  },

  likeComment: (commentId) => {
    const { comments } = get();
    const updated = { ...comments };
    for (const key of Object.keys(updated)) {
      updated[key] = updated[key].map((c) =>
        c.id === commentId ? { ...c, likes: c.likes + 1 } : c
      );
    }
    set({ comments: updated });
    get().save();
  },

  rateLevel: (levelId, rating) => {
    const { levels, userRatings } = get();
    const updatedRatings = { ...userRatings, [levelId]: rating };
    const updatedLevels = levels.map((l) => {
      if (l.id !== levelId) return l;
      const oldRating = userRatings[levelId];
      let newAvg: number;
      let newCount: number;
      if (oldRating !== undefined) {
        const totalRating = l.averageRating * l.ratingCount - oldRating + rating;
        newAvg = totalRating / l.ratingCount;
        newCount = l.ratingCount;
      } else {
        const totalRating = l.averageRating * l.ratingCount + rating;
        newCount = l.ratingCount + 1;
        newAvg = totalRating / newCount;
      }
      return { ...l, averageRating: Math.round(newAvg * 10) / 10, ratingCount: newCount };
    });
    set({ levels: updatedLevels, userRatings: updatedRatings });
    get().save();
  },

  playLevel: (levelId) => {
    set((s) => ({
      levels: s.levels.map((l) => (l.id === levelId ? { ...l, plays: l.plays + 1 } : l)),
    }));
    get().save();
  },

  recordClear: (levelId) => {
    set((s) => ({
      levels: s.levels.map((l) => (l.id === levelId ? { ...l, clears: l.clears + 1 } : l)),
    }));
    get().save();
  },

  likeLevel: (levelId) => {
    set((s) => ({
      levels: s.levels.map((l) => (l.id === levelId ? { ...l, likes: l.likes + 1 } : l)),
    }));
    get().save();
  },

  dislikeLevel: (levelId) => {
    set((s) => ({
      levels: s.levels.map((l) => (l.id === levelId ? { ...l, dislikes: l.dislikes + 1 } : l)),
    }));
    get().save();
  },

  uploadLevel: (level) => {
    const validation = deepValidateLevel(level);
    if (!validation.valid) return validation;

    const { levels } = get();
    const existing = levels.findIndex((l) => l.id === level.id);
    if (existing >= 0) {
      set({
        levels: levels.map((l, i) => (i === existing ? { ...level, updatedAt: Date.now() } : l)),
      });
    } else {
      set({ levels: [...levels, level] });
    }
    get().save();
    return validation;
  },

  deleteLevel: (levelId) => {
    set((s) => ({
      levels: s.levels.filter((l) => l.id !== levelId),
      comments: Object.fromEntries(Object.entries(s.comments).filter(([k]) => k !== levelId)),
    }));
    get().save();
  },

  toggleFeatured: (levelId) => {
    set((s) => ({
      levels: s.levels.map((l) => (l.id === levelId ? { ...l, isFeatured: !l.isFeatured } : l)),
    }));
    get().save();
  },

  updateEditorState: (updates) => {
    set((s) => {
      const newState = { ...s.editorState, ...updates };
      if (updates.gridSize && updates.gridSize !== s.editorState.gridSize) {
        const size = updates.gridSize;
        const cells: EditorCell[] = [];
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const existing = s.editorState.cells.find((cell) => cell.row === r && cell.col === c);
            cells.push(existing || { row: r, col: c, tileType: 'normal' as TileType, terrainType: null });
          }
        }
        newState.cells = cells;
      }
      return { editorState: newState };
    });
  },

  updateEditorCell: (row, col, updates) => {
    set((s) => ({
      editorState: {
        ...s.editorState,
        cells: s.editorState.cells.map((cell) =>
          cell.row === row && cell.col === col ? { ...cell, ...updates } : cell
        ),
      },
    }));
  },

  resetEditor: () => set({ editorState: defaultEditorState() }),

  setEditorTool: (tool) => set((s) => ({ editorState: { ...s.editorState, selectedTool: tool } })),

  setSelectedEnemy: (enemyId) => {
    set((s) => {
      const enemy = enemyId ? enemyPool.find((e) => e.id === enemyId) : null;
      return {
        editorState: {
          ...s.editorState,
          selectedEnemyId: enemyId,
          customEnemyConfig: enemy ? enemy.aiConfig : null,
        },
      };
    });
  },

  setTrialRecord: (record) => {
    set((s) => ({
      editorState: {
        ...s.editorState,
        trialRecord: record,
      },
    }));
    get().saveEditorDraft();
  },

  buildLevelFromEditor: () => {
    const { editorState } = get();
    const enemy = editorState.selectedEnemyId
      ? enemyPool.find((e) => e.id === editorState.selectedEnemyId)
      : null;

    if (!enemy) return null;
    if (!editorState.levelName.trim()) return null;

    const specialCells = editorState.cells.filter((c) => c.tileType !== 'normal');
    const terrainCells = editorState.cells.filter((c) => c.terrainType !== null);

    const specialTiles = {
      obstacle: editorState.cells.filter((c) => c.tileType === 'obstacle').length,
      frozen: editorState.cells.filter((c) => c.tileType === 'frozen').length,
      doubleEnergy: editorState.cells.filter((c) => c.tileType === 'double_energy').length,
      doubleEnergyDuration: 3,
    };

    const terrain: WorkshopTerrainConfig = {
      magma: editorState.cells.filter((c) => c.terrainType === 'magma').length,
      frost: editorState.cells.filter((c) => c.terrainType === 'frost').length,
      thorns: editorState.cells.filter((c) => c.terrainType === 'thorns').length,
      storm: editorState.cells.filter((c) => c.terrainType === 'storm').length,
    };

    const level: WorkshopLevel = {
      id: 'lvl_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      name: sanitizeString(editorState.levelName, 50),
      description: sanitizeString(editorState.levelDescription, 500),
      authorId: 'local_user',
      authorName: '玩家',
      background: editorState.backgroundTheme,
      enemy: {
        id: enemy.id,
        name: enemy.name,
        maxHp: enemy.maxHp,
        attack: enemy.attack,
        resistance: enemy.resistance,
        attackPattern: enemy.attackPattern,
        sprite: enemy.sprite,
        description: enemy.description,
        aiConfig: editorState.customEnemyConfig || enemy.aiConfig,
      },
      playerMaxHp: editorState.playerMaxHp,
      maxEnergy: editorState.maxEnergy,
      gridSize: editorState.gridSize,
      stars: editorState.stars,
      specialTiles,
      terrain,
      tilePlacements: [...specialCells, ...terrainCells],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      plays: 0,
      clears: 0,
      likes: 0,
      dislikes: 0,
      averageRating: 0,
      ratingCount: 0,
      isOfficial: false,
      isFeatured: false,
      difficulty: calculateDifficulty(enemy.maxHp),
      tags: [],
      trialRecord: editorState.trialRecord,
    };

    return level;
  },

  saveEditorDraft: () => {
    try {
      localStorage.setItem(EDITOR_KEY, JSON.stringify(get().editorState));
    } catch {}
  },

  loadEditorDraft: () => {
    try {
      const raw = localStorage.getItem(EDITOR_KEY);
      if (raw) {
        set({ editorState: JSON.parse(raw) });
      }
    } catch {}
  },

  getEnemyPool: () => enemyPool,

  validateAndSerialize: (level) => {
    const validation = deepValidateLevel(level);
    if (!validation.valid) return { serialized: null, validation };
    const serialized = createSecureLevelSerialization(level);
    return { serialized, validation };
  },

  verifyIntegrity: (serialized) => verifyLevelSerialization(serialized),
}));
