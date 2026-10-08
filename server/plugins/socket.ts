import { attachSocketServer } from "../game/socket";

export default defineNitroPlugin((nitroApp) => {
	nitroApp.hooks.hook("request", (event) => {
		attachSocketServer(event);
	});
});
