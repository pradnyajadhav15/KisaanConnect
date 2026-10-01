'use client';
import useRoleGate from '../../lib/useRoleGate';
import AdminDashboard from './components/AdminDashboard';

export default function AdminPage() {
  const allowed = useRoleGate('admin');
  if (!allowed) return null;
  return <AdminDashboard />;
}
