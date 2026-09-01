import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { me, type User } from './api';

interface UserContextValue {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

const UserContext = createContext<UserContextValue>({ user: null, loading: true, error: null });

/**
 * Fetches the current user once and provides it to the entire component tree.
 * Layout and other components read from context instead of re-fetching.
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    me()
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, error }}>
      {children}
    </UserContext.Provider>
  );
}

/** Read the current user from context. Never re-fetches. */
export function useUser(): UserContextValue {
  return useContext(UserContext);
}