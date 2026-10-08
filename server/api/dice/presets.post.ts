import { countPresets, createPreset, MAX_PRESETS } from "../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const body = await readBody<{ name?: unknown }>(event);
	const name = typeof body?.name === "string" ? body.name.trim() : "";
	if (!name || name.length > 40)
		throw createError({ statusCode: 400, statusMessage: "INVALID_NAME" });
	if ((await countPresets(user.id)) >= MAX_PRESETS)
		throw createError({ statusCode: 400, statusMessage: "TOO_MANY_PRESETS" });
	return await createPreset(user.id, name);
});
