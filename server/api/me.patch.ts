import { renamePlayer } from "../game/lobbies";
import { updateUserName } from "../game/store";

export default defineEventHandler(async (event) => {
	const session = await requireUserSession(event);
	const body = await readBody<{ name?: unknown }>(event);
	const name = typeof body?.name === "string" ? body.name.trim() : "";
	if (!name || name.length > 20)
		throw createError({ statusCode: 400, statusMessage: "invalid name" });

	const user = await updateUserName(session.user.id, name);
	if (!user) throw createError({ statusCode: 404 });
	await replaceUserSession(event, {
		...session,
		user: { ...session.user, name: user.name },
	});
	renamePlayer(user.id, user.name);
	return { name: user.name };
});
