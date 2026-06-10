import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { MenuPage } from '@/pages/MenuPage';
import { BattlePage } from '@/pages/BattlePage';
import EquipmentPage from '@/pages/EquipmentPage';
import { TowerPage } from '@/pages/TowerPage';
import { TowerBattlePage } from '@/pages/TowerBattlePage';
import { ArenaHomePage } from '@/pages/ArenaHomePage';
import { LoadoutConfigPage } from '@/pages/LoadoutConfigPage';
import { PVPArenaPage } from '@/pages/PVPArenaPage';
import { BattleReplayPage } from '@/pages/BattleReplayPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { useArenaStore } from '@/store/useArenaStore';

function ArenaInitializer() {
  const initializeArena = useArenaStore((s) => s.initializeArena);

  useEffect(() => {
    initializeArena();
  }, [initializeArena]);

  return null;
}

export default function App() {
  return (
    <Router>
      <ArenaInitializer />
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/battle/:levelId" element={<BattlePage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/tower" element={<TowerPage />} />
        <Route path="/tower/battle/:floor" element={<TowerBattlePage />} />
        <Route path="/arena" element={<ArenaHomePage />} />
        <Route path="/arena/loadout" element={<LoadoutConfigPage />} />
        <Route path="/arena/battle" element={<PVPArenaPage />} />
        <Route path="/arena/replay/:battleId" element={<BattleReplayPage />} />
        <Route path="/arena/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </Router>
  );
}
