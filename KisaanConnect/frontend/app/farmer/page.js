'use client';
import useRoleGate from '../../lib/useRoleGate';
import FarmerDashboard from './components/FarmerDashboard';

export default function FarmerPage() {
  const allowed = useRoleGate('farmer');
  if (!allowed) return null;
  return <FarmerDashboard />;
}
