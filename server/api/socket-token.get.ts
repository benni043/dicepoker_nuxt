import { getUser } from "../game/store";
import { createSocketToken } from "../game/token";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	if (!(await getUser(user.id))) {
		await clearUserSession(event);
		throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
	}
	return { token: createSocketToken(user.id) };
});
