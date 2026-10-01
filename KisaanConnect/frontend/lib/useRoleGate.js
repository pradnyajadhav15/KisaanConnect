'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, hasRole } from './authService';

const noSubscribe = () => () => {};

/**
 * Lets a page render only for a signed-in user with `role`.
 * Returns true when allowed; otherwise redirects to /login (signed out) or / (wrong role).
 * The login lives in localStorage, so during server rendering access is 'pending'.
 */
export default function useRoleGate(role) {
  const router = useRouter();
  const access = useSyncExternalStore(
    noSubscribe,
    () => (!isAuthenticated() ? 'login' : hasRole(role) ? 'ok' : 'wrong-role'),
    () => 'pending',
  );

  useEffect(() => {
    if (access === 'login') router.replace('/login');
    else if (access === 'wrong-role') router.replace('/');
  }, [access, router]);

  return access === 'ok';
}
