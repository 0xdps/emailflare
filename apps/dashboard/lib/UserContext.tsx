"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { me, type User } from "./api";

interface UserContextValue {
	user: User | null;
	loading: boolean;
	error: Error | null;
	isVerified: boolean;
	isCached: boolean;
	refreshUser: () => Promise<User | null>;
}

const UserContext = createContext<UserContextValue>({
	user: null,
	loading: true,
	error: null,
	isVerified: false,
	isCached: false,
	refreshUser: async () => null,
});

let memoryUser: User | null = null;

function getStoredUser(): User | null {
	if (memoryUser) return memoryUser;
	if (typeof window !== "undefined") {
		try {
			const stored = sessionStorage.getItem("ef_user");
			if (stored) {
				const parsed = JSON.parse(stored);
				memoryUser = parsed;
				return parsed;
			}
		} catch {}
	}
	return null;
}

/**
 * Fetches the current user once and provides it to the entire component tree.
 * Layout and other components read from context instead of re-fetching.
 */
export function UserProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(() => getStoredUser());
	const [loading, setLoading] = useState<boolean>(() => !getStoredUser());
	const [isVerified, setIsVerified] = useState<boolean>(false);
	const [error, setError] = useState<Error | null>(null);

	const isCached = !isVerified && !!user;

	async function refreshUser(showLoading = false): Promise<User | null> {
		if (showLoading) setLoading(true);
		try {
			const u = await me();
			memoryUser = u;
			setUser(u);
			setIsVerified(true);
			setError(null);
			if (typeof window !== "undefined") {
				try {
					sessionStorage.setItem("ef_user", JSON.stringify(u));
				} catch {}
			}
			return u;
		} catch (err: any) {
			memoryUser = null;
			setUser(null);
			setIsVerified(false);
			setError(err);
			if (typeof window !== "undefined") {
				try {
					sessionStorage.removeItem("ef_user");
				} catch {}
			}
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
		// If we already have a user in memory/storage, revalidate in background without setting loading=true
		const hasCached = !!getStoredUser();
		refreshUser(!hasCached);
	}, []);

	return (
		<UserContext.Provider value={{ user, loading, error, isVerified, isCached, refreshUser }}>
			{children}
		</UserContext.Provider>
	);
}

/** Read the current user from context. Never re-fetches. */
export function useUser(): UserContextValue {
	return useContext(UserContext);
}

/** Hook for checking user administrative privileges and product capabilities. */
export function usePermissions() {
	const { user, loading, isVerified, isCached } = useUser();

	// Destinations and capabilities must NEVER be rendered from a cached/unverified user
	const verified = isVerified && !loading;
	const isAdmin = verified && user?.user_type === "admin";

	const rawAccess = user?.access_types;
	let accessTypes: ("inbox" | "api" | "tester")[] = [];
	if (verified) {
		if (isAdmin) {
			accessTypes = ["inbox", "api", "tester"];
		} else if (Array.isArray(rawAccess)) {
			accessTypes = rawAccess;
		} else if (typeof rawAccess === "string") {
			try {
				const parsed = JSON.parse(rawAccess);
				if (Array.isArray(parsed)) accessTypes = parsed;
			} catch {
				accessTypes = [];
			}
		}
	}

	const canAccessInbox = verified && (isAdmin || accessTypes.includes("inbox"));
	const canAccessApi = verified && (isAdmin || accessTypes.includes("api"));
	const canAccessTester = verified && (isAdmin || accessTypes.includes("tester"));
	const canAccessAdmin = verified && isAdmin;

	return {
		loading,
		isVerified: verified,
		isCached,
		user,
		isAdmin,
		userType: (isAdmin ? "admin" : "member") as "admin" | "member",
		accessTypes,
		canAccessInbox,
		canAccessApi,
		canAccessTester,
		canAccessAdmin,
		hasAccess: (type: "inbox" | "api" | "tester") => verified && (isAdmin || accessTypes.includes(type)),
	};
}
