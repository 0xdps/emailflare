import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { me, type User } from "./api";

interface UserContextValue {
	user: User | null;
	loading: boolean;
	error: Error | null;
	refresh: () => Promise<User | null>;
}

const UserContext = createContext<UserContextValue>({
	user: null,
	loading: true,
	error: null,
	refresh: async () => null,
});

/**
 * Fetches the current user once and provides it to the entire component tree.
 * Layout and other components read from context instead of re-fetching.
 */
export function UserProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const refresh = React.useCallback(async () => {
		try {
			const next = await me();
			setUser(next);
			setError(null);
			return next;
		} catch (err) {
			setUser(null);
			setError(err instanceof Error ? err : new Error("Failed to load user"));
			return null;
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return <UserContext.Provider value={{ user, loading, error, refresh }}>{children}</UserContext.Provider>;
}

/** Read the current user from context. Never re-fetches. */
export function useUser(): UserContextValue {
	return useContext(UserContext);
}
