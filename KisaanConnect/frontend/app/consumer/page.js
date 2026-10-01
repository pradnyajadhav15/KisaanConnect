'use client';
import useRoleGate from '../../lib/useRoleGate';
import ConsumerDashboard from './components/ConsumerDashboard';

export default function ConsumerPage() {
  const allowed = useRoleGate('consumer');
  if (!allowed) return null;
  return <ConsumerDashboard />;
}
