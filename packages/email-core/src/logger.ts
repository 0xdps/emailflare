/**
 * Shared structured logger for EmailFlare.
 *
 * Provides a simple, zero-dependency logger with log levels and structured
 * JSON output in production. Works in both Node.js and Cloudflare Workers.
 *
 * Usage:
 *   import { createLogger } from '@emailflare/email-core/logger';
 *   const log = createLogger('my-module');
 *   log.info('something happened', { key: 'value' });
 *   log.error('something broke', err);
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
	debug(message: string, data?: unknown): void;
	info(message: string, data?: unknown): void;
	warn(message: string, data?: unknown): void;
	error(message: string, data?: unknown): void;
}

const LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

function getMinLevel(): LogLevel {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	const env = (typeof process !== "undefined" && process.env?.LOG_LEVEL) || "info";
	if (env in LEVELS) return env as LogLevel;
	return "info";
}

function isProduction(): boolean {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	return (typeof process !== "undefined" && process.env?.NODE_ENV) === "production";
}

export function createLogger(name: string): Logger {
	const minLevel = getMinLevel();
	const prod = isProduction();

	function log(level: LogLevel, message: string, data?: unknown): void {
		if (LEVELS[level] < LEVELS[minLevel]) return;

		if (prod) {
			// Structured JSON for production log aggregation
			const entry = {
				ts: new Date().toISOString(),
				level,
				name,
				message,
				...(data instanceof Error
					? { error: data.message, stack: data.stack }
					: data !== undefined
						? { data }
						: {}),
			};
			if (level === "error") {
				console.error(JSON.stringify(entry));
			} else if (level === "warn") {
				console.warn(JSON.stringify(entry));
			} else {
				console.log(JSON.stringify(entry));
			}
		} else {
			// Human-readable for development
			const prefix = `[${name}]`;
			const ts = new Date().toISOString().split("T")[1].slice(0, 12);
			if (data instanceof Error) {
				console[level](`${ts} ${prefix} ${message}:`, data.message);
			} else if (data !== undefined) {
				console[level](`${ts} ${prefix} ${message}`, data);
			} else {
				console[level](`${ts} ${prefix} ${message}`);
			}
		}
	}

	return {
		debug: (msg, data) => log("debug", msg, data),
		info: (msg, data) => log("info", msg, data),
		warn: (msg, data) => log("warn", msg, data),
		error: (msg, data) => log("error", msg, data),
	};
}
