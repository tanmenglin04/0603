import React from 'react';
import { RefreshCw, ShoppingBag, Swords, Shield } from 'lucide-react';
import type { RuneEquipment, EquipmentQuality, AffixType, ElementType } from '../types';
import {
  QUALITY_NAMES,
  QUALITY_COLORS,
  QUALITY_BG,
  AFFIX_NAMES,
  AFFIX_ICONS,
  AFFIX_FORMAT,
  ELEMENT_NAMES,
  ELEMENT_ICONS,
  ELEMENT_COLORS,
  REROLL_COST,
  SERIES_NAMES,
  SERIES_ICONS,
  SERIES_COLORS,
} from '../types';

interface EquipmentCardProps {
  equipment: RuneEquipment;
  onSelect?: () => void;
  onReroll?: (affixIndex: number) => void;
  onSell?: () => void;
  onEquip?: () => void;
  onUnequip?: () => void;
  isSelected?: boolean;
  isEquipped?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

const SELL_PRICES: Record<EquipmentQuality, number> = {
  common: 20,
  rare: 50,
  epic: 120,
  legendary: 300,
};

const GLOW_STYLES: Record<EquipmentQuality, string> = {
  common: '',
  rare: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]',
  epic: 'shadow-[0_0_16px_rgba(168,85,247,0.5)]',
  legendary: 'shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse-glow',
};

const EquipmentCard: React.FC<EquipmentCardProps> = ({
  equipment,
  onSelect,
  onReroll,
  onSell,
  onEquip,
  onUnequip,
  isSelected = false,
  isEquipped = false,
  showActions = true,
  compact = false,
}) => {
  const { element, quality, level, affixes, series } = equipment;
  const sellPrice = SELL_PRICES[quality] * level;

  return (
    <div
      className={`relative rounded-xl border-2 transition-all duration-200 ${QUALITY_BG[quality]} ${
        GLOW_STYLES[quality]
      } ${isSelected ? 'ring-2 ring-game-gold ring-offset-2 ring-offset-game-bg-dark' : ''} ${
        isEquipped ? 'ring-2 ring-green-400/60' : ''
      } ${onSelect ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      onClick={onSelect}
    >
      {isSelected && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            boxShadow: `0 0 24px ${QUALITY_COLORS[quality]}, 0 0 48px ${QUALITY_COLORS[quality]}40`,
          }}
        />
      )}

      <div className={`p-3 ${compact ? 'p-2' : 'p-3'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={compact ? 'text-base' : 'text-xl'}>{ELEMENT_ICONS[element]}</span>
            <span
              className={`font-bold ${compact ? 'text-sm' : 'text-base'}`}
              style={{ color: ELEMENT_COLORS[element] }}
            >
              {ELEMENT_NAMES[element]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {level > 1 && (
              <span className="text-xs font-semibold text-game-gold bg-game-gold/20 px-1.5 py-0.5 rounded">
                Lv.{level}
              </span>
            )}
            {series && (
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded ${compact ? 'text-[10px]' : ''}`}
                style={{
                  color: SERIES_COLORS[series],
                  backgroundColor: `${SERIES_COLORS[series]}15`,
                  border: `1px solid ${SERIES_COLORS[series]}40`,
                }}
              >
                {SERIES_ICONS[series]} {SERIES_NAMES[series]}
              </span>
            )}
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                compact ? 'text-[10px]' : ''
              }`}
              style={{
                color: QUALITY_COLORS[quality],
                backgroundColor: `${QUALITY_COLORS[quality]}20`,
                border: `1px solid ${QUALITY_COLORS[quality]}60`,
              }}
            >
              {QUALITY_NAMES[quality]}
            </span>
          </div>
        </div>

        <div className={`space-y-1 ${compact ? 'space-y-0.5' : 'space-y-1'}`}>
          {affixes.map((affix, index) => (
            <div
              key={`${affix.type}-${index}`}
              className="flex items-center gap-1.5 bg-game-bg-dark/60 rounded px-2 py-1"
            >
              <span className={compact ? 'text-xs' : 'text-sm'}>{AFFIX_ICONS[affix.type]}</span>
              <span className={`text-gray-300 ${compact ? 'text-xs' : 'text-sm'}`}>
                {AFFIX_NAMES[affix.type]}
              </span>
              <span
                className={`ml-auto font-bold ${
                  compact ? 'text-xs' : 'text-sm'
                }`}
                style={{ color: QUALITY_COLORS[quality] }}
              >
                {AFFIX_FORMAT[affix.type](affix.value)}
              </span>
              {showActions && !compact && onReroll && (
                <button
                  className="ml-1 p-1 rounded hover:bg-blue-500/30 transition-colors text-blue-400 hover:text-blue-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReroll(index);
                  }}
                  title={`重铸 (${REROLL_COST[quality]}金币)`}
                >
                  <RefreshCw size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {isEquipped && (
          <div className="mt-2 flex items-center gap-1 text-green-400 text-xs">
            <Shield size={12} />
            <span>已装备</span>
          </div>
        )}

        {showActions && !compact && (
          <div className="mt-3 flex items-center gap-2">
            {onSell && (
              <button
                className="game-button text-xs px-3 py-1.5 bg-gray-600/60 hover:bg-gray-500/70 text-gray-200 rounded-lg flex items-center gap-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSell();
                }}
              >
                <ShoppingBag size={12} />
                出售 {sellPrice}💰
              </button>
            )}
            {onEquip && !isEquipped && (
              <button
                className="game-button text-xs px-3 py-1.5 bg-green-600/60 hover:bg-green-500/70 text-green-200 rounded-lg flex items-center gap-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onEquip();
                }}
              >
                <Swords size={12} />
                装备
              </button>
            )}
            {onUnequip && isEquipped && (
              <button
                className="game-button text-xs px-3 py-1.5 bg-orange-600/60 hover:bg-orange-500/70 text-orange-200 rounded-lg flex items-center gap-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnequip();
                }}
              >
                <Swords size={12} />
                卸下
              </button>
            )}
          </div>
        )}
        {compact && onUnequip && (
          <button
            className="mt-1 w-full text-xs py-1 bg-orange-600/40 hover:bg-orange-500/50 text-orange-300 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onUnequip();
            }}
          >
            卸下
          </button>
        )}
      </div>
    </div>
  );
};

export default EquipmentCard;
