import { attachSocketServer } from "../game/socket";

// Attach socket.io on the very first request, so even websocket-only clients can connect.
export default defineNitroPlugin((nitroApp) => {
	nitroApp.hooks.hook("request", (event) => {
		attachSocketServer(event);
	});
});
