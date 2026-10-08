import { addImage, countImages, MAX_IMAGES } from "../../game/designs";

const MAX_BYTES = 512 * 1024;
const TYPES = ["image/webp", "image/png", "image/jpeg"];

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const parts = await readMultipartFormData(event);
	const file = parts?.find((p) => p.name === "file");
	if (!file?.type || !TYPES.includes(file.type))
		throw createError({ statusCode: 400, statusMessage: "INVALID_IMAGE" });
	if (file.data.length > MAX_BYTES)
		throw createError({ statusCode: 413, statusMessage: "IMAGE_TOO_LARGE" });
	if ((await countImages(user.id)) >= MAX_IMAGES)
		throw createError({ statusCode: 400, statusMessage: "TOO_MANY_IMAGES" });

	const name = (file.filename ?? "image").replace(/\.[^.]+$/, "").slice(0, 40);
	return await addImage(user.id, {
		name: name || "image",
		mime: file.type,
		data: file.data,
	});
});
