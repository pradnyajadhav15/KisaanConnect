'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, hasRole } from '../../lib/authService';
import ConsumerDashboard from './components/ConsumerDashboard';

export default function ConsumerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else if (!hasRole('consumer')) {
      router.replace('/');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;
  return <ConsumerDashboard />;
}
