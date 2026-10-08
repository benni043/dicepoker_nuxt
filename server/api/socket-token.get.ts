import { getUser } from "../game/store";
import { createSocketToken } from "../game/token";

export default defineEventHandler(async (event) => {
	const session = await requireUserSession(event);
	if (!(await getUser(session.user.id))) {
		await clearUserSession(event);
		throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
	}
	await replaceUserSession(event, {
		user: session.user,
		loggedInAt: session.loggedInAt,
	});
	return { token: createSocketToken(session.user.id) };
});
