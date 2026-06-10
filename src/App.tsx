import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MenuPage } from '@/pages/MenuPage';
import { BattlePage } from '@/pages/BattlePage';
import EquipmentPage from '@/pages/EquipmentPage';
import { TowerPage } from '@/pages/TowerPage';
import { TowerBattlePage } from '@/pages/TowerBattlePage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/battle/:levelId" element={<BattlePage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/tower" element={<TowerPage />} />
        <Route path="/tower/battle/:floor" element={<TowerBattlePage />} />
      </Routes>
    </Router>
  );
}
