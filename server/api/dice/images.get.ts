import { listImages } from "../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	return await listImages(user.id);
});
