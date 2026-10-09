import { randomUUID } from "node:crypto";
import { upsertGoogleUser } from "../../game/store";

/**
 * Play without a Google account. In development the same name always maps to the same test
 * player (handy for testing); in production every guest gets a fresh account.
 */
export default defineEventHandler(async (event) => {
	const name = String(getQuery(event).name || "")
		.trim()
		.slice(0, 20);
	if (!name)
		throw createError({ statusCode: 400, statusMessage: "name missing" });
	const user = await upsertGoogleUser({
		sub: import.meta.dev
			? `dev:${name.toLowerCase()}`
			: `guest:${randomUUID()}`,
		name,
	});
	await startSession(event, user);
	return sendRedirect(event, safeRedirect(event, getQuery(event).redirect));
});
