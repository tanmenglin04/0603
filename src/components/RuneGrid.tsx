import React, { useRef, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useRuneConnection } from '../hooks/useRuneConnection';
import { ConnectionCanvas } from './ConnectionCanvas';
import { ELEMENT_ICONS } from '../types';
import type { Rune } from '../types';

const CELL_SIZE = 64;
const GAP = 8;

export const RuneGrid: React.FC = () => {
  const gridRef = useRef<HTMLDivElement>(null);
  const { runeGrid, isPlayerTurn, battleStatus, isAnimating, comboCount, gridSize } = useGameStore();

  const { canvasRef, handleMouseDown, handleMouseMove, handleMouseUp } = useRuneConnection({
    gridRef,
    cellSize: CELL_SIZE,
    gap: GAP,
    gridSize,
  });

  const gridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${gridSize}, ${CELL_SIZE}px)`,
    gridTemplateRows: `repeat(${gridSize}, ${CELL_SIZE}px)`,
    gap: `${GAP}px`,
    width: gridSize * (CELL_SIZE + GAP) - GAP,
    height: gridSize * (CELL_SIZE + GAP) - GAP,
  }), [gridSize]);

  const getRuneClassName = (rune: Rune) => {
    if (rune.tileType === 'obstacle') {
      return 'rune rune-obstacle';
    }
    if (rune.tileType === 'frozen') {
      let cls = `rune rune-${rune.element} rune-frozen`;
      if (rune.frozenHitCount === 1) cls += ' rune-frozen-crack1';
      if (rune.isSelected) cls += ' rune-selected';
      return cls;
    }
    if (rune.tileType === 'double_energy') {
      let cls = `rune rune-${rune.element} rune-double-energy`;
      if (rune.isSelected) cls += ' rune-selected';
      if (rune.isMatched) cls += ' rune-matched';
      if (rune.isNew) cls += ' animate-pop-in';
      return cls;
    }

    let className = `rune rune-${rune.element}`;
    if (rune.isSelected) className += ' rune-selected';
    if (rune.isMatched) className += ' rune-matched';
    if (rune.isNew) className += ' animate-pop-in';
    return className;
  };

  const renderRuneContent = (rune: Rune) => {
    if (rune.tileType === 'obstacle') {
      return <span className="text-3xl">🪨</span>;
    }
    if (rune.tileType === 'frozen') {
      return (
        <div className="relative flex items-center justify-center w-full h-full">
          <span className="text-3xl">{ELEMENT_ICONS[rune.element]}</span>
          <span className="absolute top-0.5 right-0.5 text-xs">❄️</span>
          {rune.frozenHitCount === 1 && (
            <span className="absolute bottom-0.5 left-0.5 text-xs text-yellow-300">1/2</span>
          )}
        </div>
      );
    }
    if (rune.tileType === 'double_energy') {
      return (
        <div className="relative flex items-center justify-center w-full h-full">
          <span className="text-3xl">{ELEMENT_ICONS[rune.element]}</span>
          <span className="absolute top-0.5 right-0.5 text-xs">⚡2x</span>
          <span className="absolute bottom-0.5 left-0.5 text-xs text-yellow-200">
            {rune.doubleEnergyTurnsLeft}回合
          </span>
        </div>
      );
    }
    return <span className="text-3xl">{ELEMENT_ICONS[rune.element]}</span>;
  };

  const isInteractive = isPlayerTurn && battleStatus === 'playing' && !isAnimating;

  return (
    <div className="relative">
      {comboCount > 0 && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-2xl font-bold text-game-gold animate-pulse">
          {comboCount}x 连击！
        </div>
      )}
      
      <div
        ref={gridRef}
        style={gridStyle}
        className={`relative p-4 bg-game-card rounded-2xl border-2 border-game-gold/30 shadow-2xl ${
          isInteractive ? 'cursor-crosshair' : 'cursor-not-allowed opacity-75'
        }`}
        onMouseDown={isInteractive ? handleMouseDown : undefined}
        onMouseMove={isInteractive ? handleMouseMove : undefined}
        onMouseUp={isInteractive ? handleMouseUp : undefined}
        onMouseLeave={isInteractive ? handleMouseUp : undefined}
        onTouchStart={isInteractive ? handleMouseDown : undefined}
        onTouchMove={isInteractive ? handleMouseMove : undefined}
        onTouchEnd={isInteractive ? handleMouseUp : undefined}
      >
        <ConnectionCanvas ref={canvasRef} />
        
        {runeGrid.map((row) =>
          row.map((rune) => (
            <div
              key={rune.id}
              className={getRuneClassName(rune)}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
              }}
            >
              {renderRuneContent(rune)}
            </div>
          ))
        )}
      </div>
      
      <div className="mt-4 text-center text-sm text-gray-400">
        滑动连接3个以上同色符文消除并获得能量 | 🪨障碍 ❄️冰冻 ⚡双倍
      </div>
    </div>
  );
};
