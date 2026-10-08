import { searchPublicPresets } from "../../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const q = String(getQuery(event).q ?? "")
		.trim()
		.slice(0, 40);
	return await searchPublicPresets(user.id, q);
});
