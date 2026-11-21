// Runs the dashboard's own template interpreter at build time, so the syntax guide shows real output.
import { applyVariables } from "../../../../dashboard/lib/core/email.ts";

export function renderSample(template: string, vars: Record<string, unknown>): string {
	return applyVariables(template, vars);
}
