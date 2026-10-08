import { getDesignSettings, listPresets } from "../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const [presets, settings] = await Promise.all([
		listPresets(user.id),
		getDesignSettings(user.id),
	]);
	return { presets, settings };
});
