import type { BattleCodePayload, DefenderLoadout, BattleCodeVersion, ArenaPlayerProfile } from '../types';

const BATTLE_CODE_STORAGE_KEY = 'arena_battle_code_cache';
const SIGNATURE_SECRET = 'arena-pvp-v1-secret-key';

const generateId = (): string => {
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
};

const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

const generateSignature = (payload: Omit<BattleCodePayload, 'signature'>): string => {
  const dataStr = `${payload.version}|${payload.playerId}|${payload.loadoutId}|${payload.timestamp}|${SIGNATURE_SECRET}`;
  return simpleHash(dataStr);
};

const base64Encode = (str: string): string => {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  } catch {
    return '';
  }
};

const base64Decode = (str: string): string => {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(str), (c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch {
    return '';
  }
};

const compressBattleCode = (code: string): string => {
  let result = '';
  let count = 1;
  for (let i = 1; i <= code.length; i++) {
    if (i < code.length && code[i] === code[i - 1]) {
      count++;
    } else {
      result += code[i - 1];
      if (count > 1) {
        result += count.toString(36);
      }
      count = 1;
    }
  }
  return result;
};

const decompressBattleCode = (code: string): string => {
  let result = '';
  let i = 0;
  while (i < code.length) {
    const char = code[i];
    result += char;
    i++;
    let numStr = '';
    while (i < code.length && /[0-9a-z]/.test(code[i])) {
      numStr += code[i];
      i++;
    }
    if (numStr) {
      const count = parseInt(numStr, 36);
      result += char.repeat(Math.max(0, count - 1));
    }
  }
  return result;
};

const formatBattleCode = (rawCode: string): string => {
  const cleaned = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const groups: string[] = [];
  for (let i = 0; i < cleaned.length; i += 5) {
    groups.push(cleaned.substr(i, 5));
  }
  return groups.join('-');
};

export const generateBattleCode = (
  profile: ArenaPlayerProfile,
  loadout: DefenderLoadout
): string => {
  const now = Date.now();
  const version: BattleCodeVersion = 'v1';

  const payloadWithoutSig: Omit<BattleCodePayload, 'signature'> = {
    version,
    playerId: profile.playerId,
    playerName: profile.playerName,
    loadoutId: loadout.id,
    loadout,
    rankPoints: profile.rankPoints,
    currentRank: profile.currentRank,
    timestamp: now,
  };

  const signature = generateSignature(payloadWithoutSig);

  const payload: BattleCodePayload = {
    ...payloadWithoutSig,
    signature,
  };

  const jsonStr = JSON.stringify(payload);
  const encoded = base64Encode(jsonStr);
  const compressed = compressBattleCode(encoded);
  const formatted = formatBattleCode(compressed);

  try {
    const cache = JSON.parse(localStorage.getItem(BATTLE_CODE_STORAGE_KEY) || '{}');
    cache[formatted] = {
      payload,
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    };
    localStorage.setItem(BATTLE_CODE_STORAGE_KEY, JSON.stringify(cache));
  } catch {}

  return formatted;
};

const validateBattleCodePayload = (payload: BattleCodePayload): boolean => {
  if (!payload || payload.version !== 'v1') return false;
  if (!payload.playerId || !payload.loadoutId) return false;
  if (!payload.loadout || !payload.loadout.aiStyle) return false;

  const expectedSig = generateSignature({
    version: payload.version,
    playerId: payload.playerId,
    playerName: payload.playerName,
    loadoutId: payload.loadoutId,
    loadout: payload.loadout,
    rankPoints: payload.rankPoints,
    currentRank: payload.currentRank,
    timestamp: payload.timestamp,
  });

  if (payload.signature !== expectedSig) return false;

  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - payload.timestamp > oneWeek) return false;

  return true;
};

export const parseBattleCode = (code: string): BattleCodePayload | null => {
  if (!code || typeof code !== 'string') return null;

  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

  try {
    const cache = JSON.parse(localStorage.getItem(BATTLE_CODE_STORAGE_KEY) || '{}');
    for (const [cachedCode, cachedData] of Object.entries(cache)) {
      const cachedNormalized = (cachedCode as string).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cachedNormalized === normalized) {
        const data = cachedData as { payload: BattleCodePayload; expiresAt: number };
        if (Date.now() < data.expiresAt && validateBattleCodePayload(data.payload)) {
          return data.payload;
        }
      }
    }
  } catch {}

  try {
    const decompressed = decompressBattleCode(normalized);
    const decoded = base64Decode(decompressed);
    if (!decoded) return null;

    const payload = JSON.parse(decoded) as BattleCodePayload;
    if (!validateBattleCodePayload(payload)) return null;

    return payload;
  } catch (error) {
    console.error('Failed to parse battle code:', error);
    return null;
  }
};

export const isBattleCodeExpired = (payload: BattleCodePayload): boolean => {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - payload.timestamp > oneWeek;
};

export const getBattleCodeRemainingTime = (payload: BattleCodePayload): number => {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const expiresAt = payload.timestamp + oneWeek;
  return Math.max(0, expiresAt - Date.now());
};

export const generatePracticeBattleCode = (): string => {
  const practiceLoadout: DefenderLoadout = {
    id: 'practice_loadout',
    name: '练习模式',
    createdAt: Date.now(),
    equippedRunes: {},
    selectedSpellIds: ['fireball', 'water-heal', 'vine-whip', 'thunder-strike'],
    aiStyle: 'balanced',
    aiConfig: {},
    playerMaxHp: 150,
  };

  const practiceProfile: ArenaPlayerProfile = {
    playerId: 'practice_opponent',
    playerName: '练习对手',
    avatar: '🤖',
    currentRank: 'bronze',
    currentStars: 0,
    rankPoints: 50,
    highestRank: 'bronze',
    highestPoints: 50,
    totalWins: 0,
    totalLosses: 0,
    totalDraws: 0,
    winStreak: 0,
    bestWinStreak: 0,
    seasonsPlayed: 0,
    currentLoadoutId: practiceLoadout.id,
    loadouts: [practiceLoadout],
    unlockedAvatarFrames: [],
    equippedAvatarFrame: null,
  };

  return generateBattleCode(practiceProfile, practiceLoadout);
};

export { generateId };
