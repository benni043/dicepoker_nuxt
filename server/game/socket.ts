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

export function handleSocketRequest(event: H3Event) {
	attachSocketServer(event).engine.handleRequest(
		event.node.req as never,
		event.node.res as never,
	);
	event._handled = true;
}
