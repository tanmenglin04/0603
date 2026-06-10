import React, { createContext, useContext } from 'react';
import type { EnergyPool, Spell, ComboSpell, Enemy, CombatUnit, ElementType, ComboElementType } from '../types';

export interface BattleStore {
  energy: EnergyPool;
  maxEnergy: number;
  enemy: Enemy | null;
  enemyUnits: CombatUnit[];
  selectedTargetId: string | null;
  isPlayerTurn: boolean;
  battleStatus: 'idle' | 'playing' | 'victory' | 'defeat';
  isAnimating: boolean;
  floatingTexts: Array<{ id: string; text: string; x: number; y: number; color: string; createdAt: number }>;
  spellEffect: ElementType | ComboElementType | null;
  comboSpellCooldowns: Record<string, number>;
  screenShake: boolean;
  playerHp?: number;
  playerMaxHp?: number;
  castSpell: (spell: Spell) => void;
  castComboSpell: (spell: ComboSpell) => void;
  selectTarget: (unitId: string) => void;
  canCastSpell: (spell: Spell) => boolean;
  canCastComboSpell: (spell: ComboSpell) => boolean;
}

const BattleContext = createContext<BattleStore | null>(null);

export const BattleProvider: React.FC<{
  store: BattleStore;
  children: React.ReactNode;
}> = ({ store, children }) => {
  return (
    <BattleContext.Provider value={store}>
      {children}
    </BattleContext.Provider>
  );
};

export const useBattleStore = (): BattleStore => {
  const context = useContext(BattleContext);
  if (!context) {
    throw new Error('useBattleStore must be used within a BattleProvider');
  }
  return context;
};
