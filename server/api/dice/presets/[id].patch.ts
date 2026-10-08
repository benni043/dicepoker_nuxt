import type { DiceLayout, DicePreset } from "#shared/types";
import { isValidLayout, updatePreset } from "../../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const id = getRouterParam(event, "id") ?? "";
	const body = await readBody<Record<string, unknown>>(event);
	const changes: Partial<Pick<DicePreset, "name" | "layout" | "isPublic">> = {};

	if (body?.name !== undefined) {
		const name = typeof body.name === "string" ? body.name.trim() : "";
		if (!name || name.length > 40)
			throw createError({ statusCode: 400, statusMessage: "INVALID_NAME" });
		changes.name = name;
	}
	if (body?.isPublic !== undefined) changes.isPublic = body.isPublic === true;
	if (body?.layout !== undefined) {
		if (!(await isValidLayout(user.id, body.layout)))
			throw createError({ statusCode: 400, statusMessage: "INVALID_LAYOUT" });
		changes.layout = body.layout as DiceLayout;
	}

	const preset = /^[0-9a-f-]{36}$/.test(id)
		? await updatePreset(user.id, id, changes)
		: null;
	if (!preset) throw createError({ statusCode: 404 });
	return preset;
});
