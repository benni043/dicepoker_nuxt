import { getImage } from "../../../game/designs";

export default defineEventHandler(async (event) => {
	await requireUserSession(event);
	const id = getRouterParam(event, "id") ?? "";
	const image = /^[0-9a-f-]{36}$/.test(id) ? await getImage(id) : null;
	if (!image) throw createError({ statusCode: 404 });
	setResponseHeaders(event, {
		"Content-Type": image.mime,
		"Cache-Control": "private, max-age=31536000, immutable",
	});
	return image.data;
});
