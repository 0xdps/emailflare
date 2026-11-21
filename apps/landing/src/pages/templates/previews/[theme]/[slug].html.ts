import type { APIRoute, GetStaticPaths } from "astro";
import { layouts, previewHtml, themeList } from "@/components/product/templates-data";

export const getStaticPaths: GetStaticPaths = () =>
	themeList.flatMap((t) => layouts.map((l) => ({ params: { theme: t.id, slug: l.slug } })));

export const GET: APIRoute = async ({ params }) =>
	new Response(await previewHtml(params.slug!, params.theme!), {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
