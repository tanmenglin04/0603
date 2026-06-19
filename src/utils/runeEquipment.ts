import type { ElementType, EquipmentQuality, AffixType, EquipmentSeries, RuneEquipment, EquipmentAffix, ResonanceEffect } from '../types';
import {
  QUALITY_ORDER,
  QUALITY_DROP_WEIGHTS,
  QUALITY_AFFIX_COUNT,
  AFFIX_BASE_VALUES,
  SERIES_RESONANCE,
} from '../types';

const ELEMENTS: ElementType[] = ['fire', 'water', 'grass', 'thunder'];
const AFFIX_TYPES: AffixType[] = ['energy_boost', 'spell_damage', 'initial_energy'];
const ALL_SERIES: EquipmentSeries[] = ['blaze', 'frost', 'storm', 'earth'];

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const rollQuality = (levelId: number): EquipmentQuality => {
  const weights = QUALITY_DROP_WEIGHTS[levelId] || QUALITY_DROP_WEIGHTS[1];
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return QUALITY_ORDER[i];
  }
  return 'common';
};

const rollAffixes = (quality: EquipmentQuality, element: ElementType): EquipmentAffix[] => {
  const count = QUALITY_AFFIX_COUNT[quality];
  const shuffled = [...AFFIX_TYPES].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  return selected.map((type) => {
    const base = AFFIX_BASE_VALUES[type][quality];
    const variance = base * 0.2;
    const value = Math.round((base + (Math.random() * 2 - 1) * variance) * 10) / 10;
    return { type, value: Math.max(type === 'spell_damage' ? 1 : 1, value) };
  });
};

const rollSeries = (): EquipmentSeries => {
  return ALL_SERIES[Math.floor(Math.random() * ALL_SERIES.length)];
};

export const generateRuneEquipment = (levelId: number): RuneEquipment => {
  const quality = rollQuality(levelId);
  const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
  const affixes = rollAffixes(quality, element);
  const series = rollSeries();

  return {
    id: generateId(),
    element,
    quality,
    level: 1,
    affixes,
    series,
  };
};

export const generateMultipleEquipment = (levelId: number, count: number): RuneEquipment[] => {
  return Array.from({ length: count }, () => generateRuneEquipment(levelId));
};

export const canUpgrade = (items: RuneEquipment[]): boolean => {
  if (items.length !== 3) return false;
  const first = items[0];
  return items.every(
    (item) =>
      item.element === first.element &&
      item.quality === first.quality &&
      item.level === first.level &&
      item.series === first.series,
  );
};

export const upgradeEquipment = (items: RuneEquipment[]): RuneEquipment | null => {
  if (!canUpgrade(items)) return null;

  const first = items[0];
  const nextQualityIndex = QUALITY_ORDER.indexOf(first.quality);

  if (nextQualityIndex >= QUALITY_ORDER.length - 1) {
    return {
      ...first,
      level: first.level + 1,
      affixes: first.affixes.map((a) => ({
        ...a,
        value: Math.round((a.value * 1.3) * 10) / 10,
      })),
    };
  }

  const nextQuality = QUALITY_ORDER[nextQualityIndex + 1];
  const newAffixes = rollAffixes(nextQuality, first.element);
  const bestAffixValues: Record<string, number> = {};
  for (const item of items) {
    for (const affix of item.affixes) {
      if (!bestAffixValues[affix.type] || affix.value > bestAffixValues[affix.type]) {
        bestAffixValues[affix.type] = affix.value;
      }
    }
  }

  const mergedAffixes = newAffixes.map((a) => ({
    ...a,
    value: Math.max(a.value, bestAffixValues[a.type] ? bestAffixValues[a.type] * 1.1 : a.value),
  }));

  return {
    id: generateId(),
    element: first.element,
    quality: nextQuality,
    level: 1,
    affixes: mergedAffixes.map((a) => ({ ...a, value: Math.round(a.value * 10) / 10 })),
    series: first.series,
  };
};

export const rerollAffix = (
  equipment: RuneEquipment,
  affixIndex: number,
): RuneEquipment => {
  const type = equipment.affixes[affixIndex].type;
  const base = AFFIX_BASE_VALUES[type][equipment.quality];
  const levelMultiplier = 1 + (equipment.level - 1) * 0.3;
  const variance = base * 0.3;
  const value = Math.round((base * levelMultiplier + (Math.random() * 2 - 1) * variance) * 10) / 10;

  const newAffixes = [...equipment.affixes];
  newAffixes[affixIndex] = {
    type,
    value: Math.max(type === 'spell_damage' ? 1 : 1, value),
  };

  return { ...equipment, affixes: newAffixes };
};

export const getSeriesPieceCount = (
  equippedItems: RuneEquipment[],
): Record<EquipmentSeries, number> => {
  const counts: Record<EquipmentSeries, number> = { blaze: 0, frost: 0, storm: 0, earth: 0 };
  for (const item of equippedItems) {
    const s = item.series || 'blaze';
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
};

export const getActiveResonances = (
  equippedItems: RuneEquipment[],
): { series: EquipmentSeries; pieces: number; effect: ResonanceEffect; desc: string }[] => {
  const counts = getSeriesPieceCount(equippedItems);
  const result: { series: EquipmentSeries; pieces: number; effect: ResonanceEffect; desc: string }[] = [];

  for (const config of SERIES_RESONANCE) {
    const count = counts[config.series];
    if (count >= 4) {
      result.push({ series: config.series, pieces: 4, effect: config.piece4, desc: config.piece4Desc });
    } else if (count >= 2) {
      result.push({ series: config.series, pieces: 2, effect: config.piece2, desc: config.piece2Desc });
    }
  }

  return result;
};

export const getEquipmentBonuses = (
  equippedItems: RuneEquipment[],
): {
  energyBoost: Partial<Record<ElementType, number>>;
  spellDamage: Partial<Record<ElementType, number>>;
  initialEnergy: Partial<Record<ElementType, number>>;
  resonance: ResonanceEffect;
} => {
  const energyBoost: Partial<Record<ElementType, number>> = {};
  const spellDamage: Partial<Record<ElementType, number>> = {};
  const initialEnergy: Partial<Record<ElementType, number>> = {};

  for (const item of equippedItems) {
    for (const affix of item.affixes) {
      const el = item.element;
      if (affix.type === 'energy_boost') {
        energyBoost[el] = (energyBoost[el] || 0) + affix.value;
      } else if (affix.type === 'spell_damage') {
        spellDamage[el] = (spellDamage[el] || 0) + affix.value;
      } else if (affix.type === 'initial_energy') {
        initialEnergy[el] = (initialEnergy[el] || 0) + affix.value;
      }
    }
  }

  const resonance: ResonanceEffect = {};
  const activeResonances = getActiveResonances(equippedItems);
  for (const r of activeResonances) {
    if (r.effect.spellDamageBonus) {
      resonance.spellDamageBonus = (resonance.spellDamageBonus || 0) + r.effect.spellDamageBonus;
    }
    if (r.effect.energyBoostBonus) {
      resonance.energyBoostBonus = (resonance.energyBoostBonus || 0) + r.effect.energyBoostBonus;
    }
    if (r.effect.initialEnergyBonus) {
      resonance.initialEnergyBonus = (resonance.initialEnergyBonus || 0) + r.effect.initialEnergyBonus;
    }
    if (r.effect.hpRegenPerTurn) {
      resonance.hpRegenPerTurn = (resonance.hpRegenPerTurn || 0) + r.effect.hpRegenPerTurn;
    }
    if (r.effect.critChance) {
      resonance.critChance = (resonance.critChance || 0) + r.effect.critChance;
    }
    if (r.effect.damageMultiplier) {
      resonance.damageMultiplier = (resonance.damageMultiplier || 0) + r.effect.damageMultiplier;
    }
  }

  return { energyBoost, spellDamage, initialEnergy, resonance };
};
