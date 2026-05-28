import { useEffect, useState }                      from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { httpsCallable }                              from 'firebase/functions';
import { auth, googleProvider, funcs }                from '../firebase';

const getRoleFn = httpsCallable(funcs, 'getRole');

/**
 * Returns: { user, role, loading, login, logout }
 * user:    Firebase User object | null
 * role:    'siteAdmin' | 'shopAdmin' | null
 * loading: true while the initial auth state is being resolved
 */
export function useAuth() {
  const [user,    setUser]    = useState(undefined); // undefined = still loading
  const [role,    setRole]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser || null);
      if (firebaseUser) {
        try {
          const res = await getRoleFn();
          // Force token refresh so the ngfRole custom claim is picked up
          // by Firestore rules on subsequent reads
          await firebaseUser.getIdToken(true);
          setRole(res.data.role);
        } catch {
          setRole(null);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function login() {
    await signInWithPopup(auth, googleProvider);
    // onAuthStateChanged fires automatically — no need to set state here
  }

  async function logout() {
    await signOut(auth);
    setRole(null);
  }

  return { user, role, loading, login, logout };
}
