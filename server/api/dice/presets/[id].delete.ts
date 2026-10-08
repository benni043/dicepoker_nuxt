import { deletePreset } from "../../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const id = getRouterParam(event, "id") ?? "";
	if (/^[0-9a-f-]{36}$/.test(id)) await deletePreset(user.id, id);
	return { ok: true };
});
