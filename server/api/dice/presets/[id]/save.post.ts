import {
	countSavedPresets,
	MAX_SAVED,
	savePreset,
} from "../../../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const id = getRouterParam(event, "id") ?? "";
	if ((await countSavedPresets(user.id)) >= MAX_SAVED)
		throw createError({ statusCode: 400, statusMessage: "TOO_MANY_SAVED" });
	const ok = /^[0-9a-f-]{36}$/.test(id) && (await savePreset(user.id, id));
	if (!ok) throw createError({ statusCode: 404 });
	return { ok: true };
});
