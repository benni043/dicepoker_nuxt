import type { H3Event } from "h3";
import { Server } from "socket.io";
import { registerGameHandlers } from "./lobbies";
import { getUser } from "./store";
import { verifySocketToken } from "./token";

export const SOCKET_PATH = "/api/socket.io";

let io: Server | null = null;

function createServer() {
	const server = new Server({ path: SOCKET_PATH, serveClient: false });
	const game = server.of("/game");
	// Every connection must present a fresh token from /api/socket-token (session-protected).
	game.use(async (socket, next) => {
		const userId = verifySocketToken(socket.handshake.auth?.token);
		const user = userId ? await getUser(userId).catch(() => null) : null;
		if (!user) return next(new Error("UNAUTHORIZED"));
		socket.data.userId = user.id;
		next();
	});
	game.on("connection", (socket) => registerGameHandlers(socket, game));
	return server;
}

/**
 * Socket.IO hooks into Node's HTTP server lazily, on the first request of any kind
 * (see server/plugins/socket.ts); afterwards it intercepts its own requests and upgrades.
 */
export function attachSocketServer(event: H3Event) {
	io ??= createServer();
	const server = (
		event.node.res.socket as { server?: { __dicepokerSocket?: boolean } } | null
	)?.server;
	if (server && !server.__dicepokerSocket) {
		io.attach(server as never);
		server.__dicepokerSocket = true;
	}
	return io;
}

/** A socket.io request that reached h3 before socket.io was attached is handed over manually. */
export function handleSocketRequest(event: H3Event) {
	attachSocketServer(event).engine.handleRequest(
		event.node.req as never,
		event.node.res as never,
	);
	event._handled = true;
}
