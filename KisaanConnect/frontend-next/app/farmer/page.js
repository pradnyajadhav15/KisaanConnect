'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, hasRole } from '../../lib/authService';
import FarmerDashboard from './components/FarmerDashboard';

export default function FarmerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else if (!hasRole('farmer')) {
      router.replace('/');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;
  return <FarmerDashboard />;
}
