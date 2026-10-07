import { handleSocketRequest, SOCKET_PATH } from "../game/socket";

export default defineEventHandler((event) => {
	if (event.path.startsWith(SOCKET_PATH)) return handleSocketRequest(event);
	throw createError({ statusCode: 404, statusMessage: "Not Found" });
});
