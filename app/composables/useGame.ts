import { io, type Socket } from "socket.io-client";
import { localizedQuery } from "#shared/query";

export class GameRequestError extends Error {
	constructor(
		public code: string,
		public params?: Record<string, string | number>,
	) {
		super(code);
	}
}

let socket: Socket | null = null;
const connected = ref(false);

function ensureSocket() {
	if (socket) return socket;
	socket = io("/game", {
		path: "/api/socket.io",
		// Called on every (re)connect, so each attempt carries a fresh short-lived token.
		auth: async (cb) => {
			try {
				const { token } = await $fetch<{ token: string }>("/api/socket-token");
				cb({ token });
			} catch {
				cb({});
			}
		},
	});
	socket.on("connect", () => (connected.value = true));
	socket.on("disconnect", () => (connected.value = false));
	socket.on("connect_error", async (err) => {
		if (err.message !== "UNAUTHORIZED") return; // transport errors retry on their own
		const session = useUserSession();
		await session.fetch();
		if (!session.loggedIn.value) {
			const { $localePath, $router, $i18n } = useNuxtApp();
			const query = localizedQuery($i18n.locale.value, {
				redirect: $router.currentRoute.value.fullPath,
			});
			await navigateTo($localePath({ name: "login", query }));
		} else setTimeout(() => socket?.connect(), 2000);
	});
	return socket;
}

function whenConnected(): Promise<void> {
	if (connected.value) return Promise.resolve();
	return new Promise((resolve) => {
		const stop = watch(connected, (ok) => {
			if (!ok) return;
			stop();
			resolve();
		});
	});
}

async function call<T = Record<string, never>>(
	event: string,
	payload: object = {},
): Promise<T> {
	await whenConnected();
	const res = await ensureSocket()
		.timeout(10000)
		.emitWithAck(event, payload)
		.catch(() => ({ ok: false, code: "TIMEOUT" }));
	if (!res.ok) throw new GameRequestError(res.code, res.params);
	return res as T;
}

/** Closes the realtime connection, e.g. on logout. */
export function disconnectGame() {
	socket?.disconnect();
	socket = null;
	connected.value = false;
}

export function useGame() {
	const s = ensureSocket();
	const { user } = useUserSession();
	const meId = computed(() => user.value?.id ?? "");
	return { socket: s, meId, connected, call };
}

/** Turns any thrown error into a translated message. */
export function useErrorText() {
	const { t, te } = useI18n();
	return (err: unknown) => {
		if (!(err instanceof GameRequestError)) return t("errors.INTERNAL");
		const params = { ...err.params };
		if (typeof params.field === "string")
			params.field = t(`fields.${params.field}`);
		return te(`errors.${err.code}`)
			? t(`errors.${err.code}`, params)
			: t("errors.INTERNAL");
	};
}
