import { DesignLimitError, importPreset } from "../../../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const id = getRouterParam(event, "id") ?? "";
	try {
		const preset = /^[0-9a-f-]{36}$/.test(id)
			? await importPreset(user.id, id)
			: null;
		if (!preset) throw createError({ statusCode: 404 });
		return preset;
	} catch (err) {
		if (err instanceof DesignLimitError)
			throw createError({ statusCode: 400, statusMessage: err.message });
		throw err;
	}
});
