'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, hasRole } from '../../lib/authService';
import AdminDashboard from './components/AdminDashboard';

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else if (!hasRole('admin')) {
      router.replace('/');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;
  return <AdminDashboard />;
}
