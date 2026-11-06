"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { me, type User } from "./api";

interface UserContextValue {
	user: User | null;
	loading: boolean;
	error: Error | null;
	refreshUser: () => Promise<User | null>;
}

const UserContext = createContext<UserContextValue>({
	user: null,
	loading: true,
	error: null,
	refreshUser: async () => null,
});

/**
 * Fetches the current user once and provides it to the entire component tree.
 * Layout and other components read from context instead of re-fetching.
 */
export function UserProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	async function refreshUser(): Promise<User | null> {
		setLoading(true);
		try {
			const u = await me();
			setUser(u);
			setError(null);
			return u;
		} catch (err: any) {
			setUser(null);
			setError(err);
			return null;
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		const path = window.location.pathname;
		if (path.startsWith("/login") || path.startsWith("/setup") || path.startsWith("/invite")) {
			setLoading(false);
			return;
		}
		refreshUser();
	}, []);

	return <UserContext.Provider value={{ user, loading, error, refreshUser }}>{children}</UserContext.Provider>;
}

/** Read the current user from context. Never re-fetches. */
export function useUser(): UserContextValue {
	return useContext(UserContext);
}
