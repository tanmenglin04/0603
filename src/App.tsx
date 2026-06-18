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
import { P2PRoomPage } from '@/pages/P2PRoomPage';
import { BattleReplayPage } from '@/pages/BattleReplayPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { AchievementPage } from '@/pages/AchievementPage';
import { WorkshopPage } from '@/pages/WorkshopPage';
import { WorkshopLevelDetailPage } from '@/pages/WorkshopLevelDetailPage';
import { LevelEditorPage } from '@/pages/LevelEditorPage';
import { TrialPlayPage } from '@/pages/TrialPlayPage';
import { useArenaStore } from '@/store/useArenaStore';
import { AudioProvider } from '@/audio/AudioContext';

function ArenaInitializer() {
  const initializeArena = useArenaStore((s) => s.initializeArena);

  useEffect(() => {
    initializeArena();
  }, [initializeArena]);

  return null;
}

export default function App() {
  return (
    <AudioProvider>
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
          <Route path="/arena/p2p" element={<P2PRoomPage />} />
          <Route path="/arena/battle" element={<PVPArenaPage />} />
          <Route path="/replay" element={<BattleReplayPage />} />
          <Route path="/arena/replay/:battleId" element={<BattleReplayPage />} />
          <Route path="/arena/leaderboard" element={<LeaderboardPage />} />
          <Route path="/achievements" element={<AchievementPage />} />
          <Route path="/workshop" element={<WorkshopPage />} />
          <Route path="/workshop/level/:levelId" element={<WorkshopLevelDetailPage />} />
          <Route path="/workshop/editor" element={<LevelEditorPage />} />
          <Route path="/workshop/trial" element={<TrialPlayPage />} />
        </Routes>
      </Router>
    </AudioProvider>
  );
}
