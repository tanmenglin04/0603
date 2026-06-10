import React from 'react';
import { useNavigate } from 'react-router-dom';
import EquipmentPanel from '../components/EquipmentPanel';

const EquipmentPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full">
      <EquipmentPanel onBack={() => navigate('/')} />
    </div>
  );
};

export default EquipmentPage;
