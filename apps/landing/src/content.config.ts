import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const docs = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		section: z.enum(["Start", "Send API", "Templates", "Inbox", "Operate"]),
		order: z.number(),
	}),
});

export const collections = { docs };
