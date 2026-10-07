import { upsertGoogleUser } from "../../game/store";

// Development-only login so several local players can be tested without Google.
// `import.meta.dev` is false in production builds, so this route always 404s there.
export default defineEventHandler(async (event) => {
	if (!import.meta.dev) throw createError({ statusCode: 404 });
	const name = String(getQuery(event).name || "")
		.trim()
		.slice(0, 20);
	if (!name)
		throw createError({ statusCode: 400, statusMessage: "name missing" });
	const user = await upsertGoogleUser({
		sub: `dev:${name.toLowerCase()}`,
		name,
	});
	await startSession(event, user);
	return sendRedirect(event, safeRedirect(event, getQuery(event).redirect));
});
