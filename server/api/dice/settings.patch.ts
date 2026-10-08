import type { DesignSettings } from "#shared/types";
import { getPreset, updateDesignSettings } from "../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const body = await readBody<Record<string, unknown>>(event);
	const changes: Partial<DesignSettings> = {};
	if (typeof body?.alwaysOwn === "boolean") changes.alwaysOwn = body.alwaysOwn;
	if (body?.defaultPresetId === null) changes.defaultPresetId = null;
	else if (typeof body?.defaultPresetId === "string") {
		if (!(await getPreset(user.id, body.defaultPresetId)))
			throw createError({ statusCode: 400, statusMessage: "INVALID_PRESET" });
		changes.defaultPresetId = body.defaultPresetId;
	}
	await updateDesignSettings(user.id, changes);
	return { ok: true };
});
