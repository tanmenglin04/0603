import React from 'react';
import { useBattleStore } from '../contexts/BattleContext';
import { ELEMENT_ICONS, ELEMENT_COLORS } from '../types';
import type { ElementType } from '../types';

const ELEMENTS: ElementType[] = ['fire', 'water', 'grass', 'thunder'];

export const EnergyPool: React.FC = () => {
  const { energy, maxEnergy } = useBattleStore();

  return (
    <div className="game-card p-6">
      <h3 className="text-lg font-bold text-game-gold mb-4 text-center font-display">
        元素能量
      </h3>
      <div className="grid grid-cols-4 gap-4">
        {ELEMENTS.map((element) => {
          const current = energy[element];
          const percentage = (current / maxEnergy) * 100;
          const color = ELEMENT_COLORS[element];
          
          return (
            <div key={element} className="flex flex-col items-center">
              <div className="relative w-16 h-16">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="#1a0b2e"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                    strokeDasharray={`${percentage * 1.76} 176`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                    style={{
                      filter: `drop-shadow(0 0 8px ${color})`,
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">{ELEMENT_ICONS[element]}</span>
                </div>
              </div>
              <div
                className="mt-2 text-lg font-bold"
                style={{ color }}
              >
                {current}/{maxEnergy}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
