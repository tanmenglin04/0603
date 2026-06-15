import type {
  BattleReplayV2,
  BattleEvent,
  HighlightMoment,
  HighlightType,
  ShareCardData,
  ElementType,
  BattleEventType,
  ChainComboPayload,
  CastSpellPayload,
  HpChangePayload,
  EnemyBehaviorPayload,
  MatchRunesPayload,
  CastComboSpellPayload,
} from '../types';
import {
  HIGHLIGHT_TYPE_META,
  ELEMENT_COLORS,
  ELEMENT_NAMES,
} from '../types';
import { generateId } from './gameLogic';

type DetectionContext = {
  replay: BattleReplayV2;
  prevEvent: BattleEvent | null;
  events: BattleEvent[];
  idx: number;
  highlights: HighlightMoment[];
  lowestPlayerHp: number;
  lowestPlayerHpPercent: number;
  lowestHpEventIndex: number;
};

export class HighlightDetector {
  private replay: BattleReplayV2;

  constructor(replay: BattleReplayV2) {
    this.replay = replay;
  }

  detect(): HighlightMoment[] {
    const highlights: HighlightMoment[] = [];
    const events = this.replay.events;
    const maxHp = this.replay.initialState.playerMaxHp;

    let lowestPlayerHp = maxHp;
    let lowestHpEventIndex = -1;
    let lowestPlayerHpPercent = 1;

    for (let idx = 0; idx < events.length; idx++) {
      const evt = events[idx];
      const prevEvent = idx > 0 ? events[idx - 1] : null;

      if (evt.type === BattleEventType.PLAYER_HP_CHANGE) {
        const hp = evt.payload as HpChangePayload;
        if (hp.newHp < lowestPlayerHp) {
          lowestPlayerHp = hp.newHp;
          lowestHpEventIndex = idx;
          lowestPlayerHpPercent = hp.newHp / hp.maxHp;
        }
      }

      const ctx: DetectionContext = {
        replay: this.replay,
        prevEvent,
        events,
        idx,
        highlights,
        lowestPlayerHp,
        lowestPlayerHpPercent,
        lowestHpEventIndex,
      };

      this.detectMegaCombo(ctx);
      this.detectPerfectChain(ctx);
      this.detectCritKillBoss(ctx);
      this.detectSpellBurst(ctx);
      this.detectBossSlayer(ctx);
    }

    this.detectLowHpComeback(
      highlights,
      events,
      lowestPlayerHp,
      lowestPlayerHpPercent,
      lowestHpEventIndex
    );
    this.dedupeHighlights(highlights);

    highlights.sort((a, b) => a.startEventIndex - b.startEventIndex);
    return highlights;
  }

  private detectMegaCombo(ctx: DetectionContext): void {
    const { idx, events, highlights } = ctx;
    const evt = events[idx];

    if (evt.type !== BattleEventType.CHAIN_COMBO) return;
    const payload = evt.payload as ChainComboPayload;

    if (payload.totalChainCount >= 3) {
      const startIdx = this.findStartOfComboChain(events, idx);
      const endIdx = this.findEndOfComboChain(events, idx);

      highlights.push({
        id: generateId(),
        type: 'mega_combo',
        title: `${payload.totalChainCount}次超级连消!`,
        description: `触发了${payload.totalChainCount}次连锁消除，共消除${Object.values(payload.matchedElements).reduce((a, b) => a + b, 0)}个符文`,
        startEventIndex: startIdx,
        endEventIndex: endIdx,
        startTimestamp: events[startIdx]?.timestamp || evt.timestamp,
        endTimestamp: events[endIdx]?.timestamp || evt.timestamp,
        data: {
          chainCount: payload.totalChainCount,
          totalRunes: Object.values(payload.matchedElements).reduce((a, b) => a + b, 0),
        },
        icon: HIGHLIGHT_TYPE_META.mega_combo.icon,
      });
    }
  }

  private detectPerfectChain(ctx: DetectionContext): void {
    const { idx, events, highlights } = ctx;
    const evt = events[idx];

    if (evt.type !== BattleEventType.MATCH_RUNES) return;
    const payload = evt.payload as MatchRunesPayload;

    if (payload.matchCount >= 6 || payload.path.length >= 7) {
      const endIdx = Math.min(idx + 5, events.length - 1);
      highlights.push({
        id: generateId(),
        type: 'perfect_chain',
        title: `完美连接 ${payload.matchCount}连!`,
        description: `一次性连接${payload.matchCount}个${ELEMENT_NAMES[payload.element]}符文，${payload.isDoubleEnergy ? '含双倍能量格!' : ''}`,
        startEventIndex: Math.max(0, idx - 1),
        endEventIndex: endIdx,
        startTimestamp: evt.timestamp,
        endTimestamp: events[endIdx]?.timestamp || evt.timestamp,
        data: {
          matchCount: payload.matchCount,
          element: payload.element,
          isDoubleEnergy: payload.isDoubleEnergy,
        },
        icon: HIGHLIGHT_TYPE_META.perfect_chain.icon,
      });
    }
  }

  private detectCritKillBoss(ctx: DetectionContext): void {
    const { idx, events, highlights, replay } = ctx;
    const evt = events[idx];
    const enemyMaxHp = replay.initialState.enemyMaxHp;

    if (
      evt.type !== BattleEventType.CAST_SPELL &&
      evt.type !== BattleEventType.CAST_COMBO_SPELL
    )
      return;

    let damage = 0;
    let spellName = '';
    let element: ElementType | null = null;
    let isCritical = false;
    let targetKilled = false;

    if (evt.type === BattleEventType.CAST_SPELL) {
      const payload = evt.payload as CastSpellPayload;
      damage = payload.damageDealt;
      spellName = payload.spellName;
      element = payload.element;
      isCritical = !!payload.isCritical;
      targetKilled = payload.targetKilled;
    } else {
      const payload = evt.payload as CastComboSpellPayload;
      damage = payload.damageDealt;
      spellName = payload.spellName;
      targetKilled = payload.targetKilled;
    }

    const isBigDamage = damage >= enemyMaxHp * 0.35;
    const isOneShot = targetKilled && damage >= enemyMaxHp * 0.5;

    if ((isCritical && isBigDamage) || isOneShot) {
      const endIdx = Math.min(idx + 3, events.length - 1);
      highlights.push({
        id: generateId(),
        type: 'crit_kill_boss',
        title: isOneShot ? '暴击秒杀!' : '暴击大伤害!',
        description: `${spellName}${element ? `(${ELEMENT_NAMES[element]})` : ''}造成${damage}点伤害${isCritical ? '，暴击命中!' : ''}${targetKilled ? '，一击毙命!' : ''}`,
        startEventIndex: Math.max(0, idx - 1),
        endEventIndex: endIdx,
        startTimestamp: evt.timestamp,
        endTimestamp: events[endIdx]?.timestamp || evt.timestamp,
        data: {
          damage,
          spellName,
          element,
          isCritical,
          targetKilled,
          percentOfMaxHp: Math.round((damage / enemyMaxHp) * 100),
        },
        icon: HIGHLIGHT_TYPE_META.crit_kill_boss.icon,
      });
    }
  }

  private detectSpellBurst(ctx: DetectionContext): void {
    const { idx, events, highlights } = ctx;
    const evt = events[idx];

    if (evt.type !== BattleEventType.ENEMY_HP_CHANGE) return;
    const payload = evt.payload as HpChangePayload;

    if (idx < 3) return;

    let totalRecentDamage = 0;
    let startIdx = idx;
    const windowStart = Math.max(0, idx - 5);

    for (let i = idx; i >= windowStart; i--) {
      const e = events[i];
      if (e.type === BattleEventType.ENEMY_HP_CHANGE) {
        const hp = e.payload as HpChangePayload;
        if (hp.delta < 0) {
          totalRecentDamage += Math.abs(hp.delta);
          startIdx = i;
        }
      }
      if (e.type === BattleEventType.CAST_SPELL || e.type === BattleEventType.CAST_COMBO_SPELL) {
        startIdx = Math.min(startIdx, i);
      }
    }

    const threshold = this.replay.initialState.enemyMaxHp * 0.5;
    if (totalRecentDamage >= threshold) {
      const existing = highlights.find(
        (h) => h.type === 'spell_burst' && Math.abs(h.endEventIndex - idx) <= 3
      );
      if (!existing) {
        highlights.push({
          id: generateId(),
          type: 'spell_burst',
          title: '法术爆发!',
          description: `短时间内造成${totalRecentDamage}点爆发伤害，相当于${Math.round((totalRecentDamage / this.replay.initialState.enemyMaxHp) * 100)}%的血量`,
          startEventIndex: Math.max(0, startIdx - 1),
          endEventIndex: Math.min(idx + 2, events.length - 1),
          startTimestamp: events[startIdx]?.timestamp || evt.timestamp,
          endTimestamp: evt.timestamp,
          data: {
            totalDamage: totalRecentDamage,
            percentOfMaxHp: Math.round((totalRecentDamage / this.replay.initialState.enemyMaxHp) * 100),
          },
          icon: HIGHLIGHT_TYPE_META.spell_burst.icon,
        });
      }
    }
  }

  private detectBossSlayer(ctx: DetectionContext): void {
    const { idx, events, highlights, replay } = ctx;
    const evt = events[idx];

    if (evt.type !== BattleEventType.BATTLE_END) return;
    const result = (evt.payload as any).result;
    if (result !== 'victory') return;

    if (replay.stats.maxComboReached >= 5 || replay.stats.totalDamageDealt >= replay.initialState.enemyMaxHp * 1.2) {
      const startIdx = Math.max(0, events.length - 8);
      highlights.push({
        id: generateId(),
        type: 'boss_slayer',
        title: 'BOSS终结者!',
        description: `成功击败${replay.enemyName}! 共造成${replay.stats.totalDamageDealt}点伤害，最高连击${replay.stats.maxComboReached}次`,
        startEventIndex: startIdx,
        endEventIndex: events.length - 1,
        startTimestamp: events[startIdx]?.timestamp || evt.timestamp,
        endTimestamp: evt.timestamp,
        data: {
          totalDamage: replay.stats.totalDamageDealt,
          maxCombo: replay.stats.maxComboReached,
        },
        icon: HIGHLIGHT_TYPE_META.boss_slayer.icon,
      });
    }
  }

  private detectLowHpComeback(
    highlights: HighlightMoment[],
    events: BattleEvent[],
    lowestHp: number,
    lowestHpPercent: number,
    lowestHpIdx: number
  ): void {
    if (lowestHpIdx < 0) return;
    if (lowestHpPercent > 0.15) return;
    if (this.replay.result !== 'victory') return;

    let recoveryEndIdx = lowestHpIdx;
    let recoveredHp = lowestHp;
    for (let i = lowestHpIdx; i < events.length; i++) {
      const e = events[i];
      if (e.type === BattleEventType.PLAYER_HP_CHANGE) {
        const hp = e.payload as HpChangePayload;
        recoveredHp = hp.newHp;
        if (hp.newHp >= this.replay.initialState.playerMaxHp * 0.5) {
          recoveryEndIdx = i;
          break;
        }
      }
    }

    if (recoveryEndIdx > lowestHpIdx || recoveredHp > lowestHp) {
      const startIdx = Math.max(0, lowestHpIdx - 2);
      highlights.push({
        id: generateId(),
        type: 'low_hp_comeback',
        title: '丝血反杀!',
        description: `在血量仅剩${lowestHp}(${Math.round(lowestHpPercent * 100)}%)的极限状态下逆转战局，最终取得胜利!`,
        startEventIndex: startIdx,
        endEventIndex: Math.min(recoveryEndIdx + 3, events.length - 1),
        startTimestamp: events[startIdx]?.timestamp || Date.now(),
        endTimestamp: events[Math.min(recoveryEndIdx, events.length - 1)]?.timestamp || Date.now(),
        data: {
          lowestHp,
          lowestHpPercent: Math.round(lowestHpPercent * 100),
          recoveredTo: recoveredHp,
        },
        icon: HIGHLIGHT_TYPE_META.low_hp_comeback.icon,
      });
    }
  }

  private findStartOfComboChain(events: BattleEvent[], idx: number): number {
    for (let i = idx; i >= 0; i--) {
      const e = events[i];
      if (
        e.type === BattleEventType.MATCH_RUNES ||
        (e.type === BattleEventType.CHAIN_COMBO &&
          (e.payload as ChainComboPayload).comboLevel === 1)
      ) {
        return Math.max(0, i - 1);
      }
    }
    return Math.max(0, idx - 3);
  }

  private findEndOfComboChain(events: BattleEvent[], idx: number): number {
    for (let i = idx; i < events.length; i++) {
      const e = events[i];
      if (e.type === BattleEventType.TURN_END || e.type === BattleEventType.ENEMY_BEHAVIOR) {
        return i;
      }
    }
    return Math.min(idx + 5, events.length - 1);
  }

  private dedupeHighlights(highlights: HighlightMoment[]): void {
    const seen = new Set<string>();
    for (let i = highlights.length - 1; i >= 0; i--) {
      const h = highlights[i];
      const key = `${h.type}-${h.startEventIndex}-${h.endEventIndex}`;
      if (seen.has(key)) {
        highlights.splice(i, 1);
      } else {
        seen.add(key);
      }
    }

    const typeMaxCount: Record<HighlightType, number> = {
      mega_combo: 3,
      crit_kill_boss: 2,
      low_hp_comeback: 1,
      perfect_chain: 2,
      spell_burst: 2,
      boss_slayer: 1,
    };
    const counts: Record<string, number> = {};
    for (let i = highlights.length - 1; i >= 0; i--) {
      const h = highlights[i];
      const c = counts[h.type] || 0;
      if (c >= typeMaxCount[h.type]) {
        highlights.splice(i, 1);
      } else {
        counts[h.type] = c + 1;
      }
    }
  }
}

export const detectHighlights = (replay: BattleReplayV2): HighlightMoment[] => {
  const detector = new HighlightDetector(replay);
  return detector.detect();
};

export const generateShareCard = (
  replay: BattleReplayV2,
  highlight: HighlightMoment
): ShareCardData => {
  const meta = HIGHLIGHT_TYPE_META[highlight.type];
  const stats: ShareCardData['stats'] = {};

  switch (highlight.type) {
    case 'mega_combo':
      stats.maxCombo = highlight.data.chainCount as number;
      stats.totalDamage = replay.stats.totalDamageDealt;
      break;
    case 'crit_kill_boss':
      stats.critDamage = highlight.data.damage as number;
      break;
    case 'low_hp_comeback':
      stats.remainingHpPercent = highlight.data.lowestHpPercent as number;
      stats.remainingHp = highlight.data.lowestHp as number;
      break;
    case 'perfect_chain':
      stats.maxCombo = highlight.data.matchCount as number;
      break;
    case 'spell_burst':
      stats.totalDamage = highlight.data.totalDamage as number;
      break;
    case 'boss_slayer':
      stats.totalDamage = highlight.data.totalDamage as number;
      stats.maxCombo = highlight.data.maxCombo as number;
      break;
  }

  const uniqueElements = new Set<ElementType>();
  for (const e of replay.events) {
    if (e.type === BattleEventType.MATCH_RUNES) {
      uniqueElements.add((e.payload as MatchRunesPayload).element);
    }
  }

  let bg = meta.color;
  let accent = ELEMENT_COLORS.fire;
  const primaryElement = Array.from(uniqueElements)[0];
  if (primaryElement) {
    accent = ELEMENT_COLORS[primaryElement];
  }

  return {
    highlightId: highlight.id,
    highlightType: highlight.type,
    title: highlight.title,
    subtitle: highlight.description,
    battleId: replay.battleId,
    levelId: replay.levelId,
    levelName: replay.levelName,
    enemyName: replay.enemyName,
    result: replay.result,
    totalTurns: replay.totalTurns,
    stats,
    runeEffects: Array.from(uniqueElements),
    backgroundColor: bg,
    accentColor: accent,
    generatedAt: Date.now(),
  };
};

export const generateAllShareCards = (
  replay: BattleReplayV2,
  highlights: HighlightMoment[]
): ShareCardData[] => {
  return highlights.map((h) => generateShareCard(replay, h));
};
