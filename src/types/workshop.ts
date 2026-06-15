import type { TileType, TerrainType, EnemyAIConfig, ElementType } from './index';

export type EditorTool = 'select' | 'obstacle' | 'frozen' | 'double_energy' | 'terrain_magma' | 'terrain_frost' | 'terrain_thorns' | 'terrain_storm' | 'eraser';

export type WorkshopSortType = 'hot' | 'clear_rate' | 'newest' | 'rating';

export type WorkshopCategory = 'all' | 'official' | 'easy' | 'medium' | 'hard' | 'extreme';

export interface EditorCell {
  row: number;
  col: number;
  tileType: TileType;
  terrainType: TerrainType | null;
}

export interface EditorState {
  gridSize: number;
  cells: EditorCell[];
  selectedTool: EditorTool;
  levelName: string;
  levelDescription: string;
  backgroundTheme: string;
  playerMaxHp: number;
  maxEnergy: number;
  stars: number[];
  selectedEnemyId: string | null;
  customEnemyConfig: Partial<EnemyAIConfig> | null;
  trialRecord: TrialRecord | null;
}

export interface WorkshopLevel {
  id: string;
  name: string;
  description: string;
  authorId: string;
  authorName: string;
  background: string;
  enemy: WorkshopEnemy;
  playerMaxHp: number;
  maxEnergy: number;
  gridSize: number;
  stars: number[];
  specialTiles: WorkshopSpecialTiles;
  terrain: WorkshopTerrainConfig;
  tilePlacements: EditorCell[];
  createdAt: number;
  updatedAt: number;
  plays: number;
  clears: number;
  likes: number;
  dislikes: number;
  averageRating: number;
  ratingCount: number;
  isOfficial: boolean;
  isFeatured: boolean;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  tags: string[];
  trialRecord: TrialRecord | null;
}

export interface WorkshopEnemy {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  resistance: Partial<Record<ElementType, number>>;
  attackPattern: number[];
  sprite: string;
  description: string;
  aiConfig: EnemyAIConfig;
}

export interface WorkshopSpecialTiles {
  obstacle: number;
  frozen: number;
  doubleEnergy: number;
  doubleEnergyDuration: number;
}

export interface WorkshopTerrainConfig {
  magma: number;
  frost: number;
  thorns: number;
  storm: number;
  magmaSpreadChance?: number;
}

export interface TrialRecord {
  completed: boolean;
  turnsTaken: number;
  playerHpRemaining: number;
  recordedAt: number;
  actions: TrialAction[];
}

export interface TrialAction {
  turn: number;
  type: 'match' | 'spell' | 'combo_spell' | 'end_turn';
  timestamp: number;
  data: any;
}

export interface WorkshopComment {
  id: string;
  levelId: string;
  authorId: string;
  authorName: string;
  content: string;
  rating: number;
  createdAt: number;
  likes: number;
  isOfficial: boolean;
}

export interface WorkshopUserProfile {
  id: string;
  name: string;
  avatar: string;
  createdLevels: number;
  totalPlays: number;
  totalLikes: number;
  averageRating: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface LevelSerialization {
  version: string;
  checksum: string;
  data: WorkshopLevel;
}

export const WORKSHOP_VERSION = '1.0.0';

export const BACKGROUNDS = [
  { id: 'forest', name: '森林', icon: '🌲', color: '#228b22' },
  { id: 'cave', name: '洞穴', icon: '🕳️', color: '#4a4a4a' },
  { id: 'canyon', name: '峡谷', icon: '🏜️', color: '#cd853f' },
  { id: 'ocean', name: '海洋', icon: '🌊', color: '#1e90ff' },
  { id: 'castle', name: '城堡', icon: '🏰', color: '#696969' },
  { id: 'volcano', name: '火山', icon: '🌋', color: '#ff4500' },
  { id: 'snow', name: '雪原', icon: '❄️', color: '#b0e0e6' },
  { id: 'cosmic', name: '星空', icon: '🌌', color: '#191970' },
];

export const DIFFICULTY_META = {
  easy: { name: '简单', color: '#22c55e', minHp: 1, maxHp: 100 },
  medium: { name: '中等', color: '#eab308', minHp: 101, maxHp: 200 },
  hard: { name: '困难', color: '#f97316', minHp: 201, maxHp: 350 },
  extreme: { name: '极难', color: '#ef4444', minHp: 351, maxHp: 9999 },
};

export const WORKSHOP_SORT_OPTIONS: { value: WorkshopSortType; label: string; icon: string }[] = [
  { value: 'hot', label: '热度', icon: '🔥' },
  { value: 'clear_rate', label: '通关率', icon: '✅' },
  { value: 'newest', label: '最新发布', icon: '🆕' },
  { value: 'rating', label: '评分', icon: '⭐' },
];

export const WORKSHOP_CATEGORIES: { value: WorkshopCategory; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'official', label: '官方精选' },
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
  { value: 'extreme', label: '极难' },
];
