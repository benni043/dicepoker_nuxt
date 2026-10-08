import {
	getDesignSettings,
	listPresets,
	listSavedPresets,
} from "../../game/designs";

export default defineEventHandler(async (event) => {
	const { user } = await requireUserSession(event);
	const [presets, saved, settings] = await Promise.all([
		listPresets(user.id),
		listSavedPresets(user.id),
		getDesignSettings(user.id),
	]);
	return { presets, saved, settings };
});
