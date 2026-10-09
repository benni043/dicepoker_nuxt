import { randomInt } from "node:crypto";
import type { Namespace, Socket } from "socket.io";
import {
	bestMove,
	type Category,
	DICE_COUNT,
	isSheetComplete,
	isUpper,
	MAX_COLUMNS,
	MAX_PLAYERS,
	MAX_ROLLS,
	MIN_PLAYERS,
	RULESET_IDS,
	type RulesetId,
	rulesetOf,
	type ScoreColumn,
	sheetTotal,
	TURN_TIMEOUTS,
} from "#shared/game";
import type {
	AutoReason,
	DieState,
	LastAction,
	LobbyDesign,
	LobbyNotice,
	LobbyPhase,
	LobbyState,
	LobbySummary,
	PublicPlayer,
	RollAnimation,
} from "#shared/types";
import { autoRollTurn } from "./autoplay";
import { getUsablePreset } from "./designs";
import { simulateRoll } from "./physics";
import {
	deleteLobbyRecord,
	getLeaderboard,
	getStats,
	getUser,
	hashPassword,
	loadLobbyRecords,
	recordGame,
	saveLobbyRecord,
	verifyPassword,
} from "./store";

interface LobbyPlayer {
	id: string;
	name: string;
}

interface Game {
	order: string[];
	names: Record<string, string>;
	turn: number;
	rollCount: number;
	dice: DieState[];
	scores: Record<string, ScoreColumn[]>;
	rollingUntil: number;
	lastAction: LastAction | null;
	turnDeadline: number | null;
}

interface Lobby {
	id: string;
	name: string;
	passwordHash: string;
	hostId: string;
	ruleset: RulesetId;
	design: LobbyDesign | null;
	columns: number;
	maxPlayers: number;
	turnTimeout: number;
	phase: LobbyPhase;
	players: LobbyPlayer[];
	spectators: LobbyPlayer[];
	game: Game | null;
	winners: string[];
	rounds: number;
	createdAt: number;
	updatedAt: number;
}

class GameError extends Error {
	constructor(
		public code: string,
		public params?: Record<string, string | number>,
	) {
		super(code);
	}
}

const LOBBY_TTL = 7 * 24 * 3600 * 1000;
const RECENT_FINISHED = 6 * 3600 * 1000;
const ABANDON_AFTER = 5 * 60 * 1000;
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const lobbies = new Map<string, Lobby>();
const presence = new Map<string, Map<string, Set<string>>>();
const persistTimers = new Map<string, NodeJS.Timeout>();
const abandonTimers = new Map<string, NodeJS.Timeout>();
const turnTimers = new Map<string, NodeJS.Timeout>();
let loading: Promise<void> | null = null;
let ns: Namespace | null = null;

const room = (lobbyId: string) => `lobby:${lobbyId}`;
const userRoom = (userId: string) => `user:${userId}`;
const members = (lobby: Lobby) => [...lobby.players, ...lobby.spectators];
const isPlayer = (lobby: Lobby, id: string) =>
	lobby.players.some((p) => p.id === id);
const isMember = (lobby: Lobby, id: string) =>
	members(lobby).some((p) => p.id === id);
const nameOf = (lobby: Lobby, id: string) =>
	members(lobby).find((p) => p.id === id)?.name ?? lobby.game?.names[id] ?? "?";

function ensureLoaded() {
	loading ??= (async () => {
		for (const { data: lobby, updatedAt } of await loadLobbyRecords<Lobby>()) {
			if (Date.now() - updatedAt.getTime() < LOBBY_TTL) {
				lobby.spectators ??= [];
				lobby.ruleset ??= "poker";
				lobby.design ??= null;
				lobby.turnTimeout ??= 0;
				if (lobby.game) {
					lobby.game.names ??= Object.fromEntries(
						lobby.players.map((p) => [p.id, p.name]),
					);
					lobby.game.turnDeadline ??= null;
				}
				lobbies.set(lobby.id, lobby);
				checkAbandoned(lobby);
				resumeTurnTimer(lobby);
			} else {
				await deleteLobbyRecord(lobby.id);
			}
		}
	})().catch((err) => {
		loading = null;
		throw err;
	});
	return loading;
}

function touch(lobby: Lobby) {
	lobby.updatedAt = Date.now();
	clearTimeout(persistTimers.get(lobby.id));
	persistTimers.set(
		lobby.id,
		setTimeout(() => {
			persistTimers.delete(lobby.id);
			if (lobbies.has(lobby.id))
				saveLobbyRecord(lobby.id, lobby).catch(console.error);
		}, 250),
	);
}

function removeLobby(lobby: Lobby) {
	lobbies.delete(lobby.id);
	presence.delete(lobby.id);
	clearTimeout(persistTimers.get(lobby.id));
	clearTimeout(abandonTimers.get(lobby.id));
	abandonTimers.delete(lobby.id);
	stopTurnTimer(lobby);
	deleteLobbyRecord(lobby.id).catch(console.error);
	ns?.in(room(lobby.id)).socketsLeave(room(lobby.id));
}

function isOnline(lobbyId: string, userId: string) {
	return (presence.get(lobbyId)?.get(userId)?.size ?? 0) > 0;
}

function publicState(lobby: Lobby): LobbyState {
	const g = lobby.game;
	const toPublic = (p: LobbyPlayer): PublicPlayer => ({
		id: p.id,
		name: p.name,
		connected: isOnline(lobby.id, p.id),
		total: sheetTotal(rulesetOf(lobby.ruleset), g?.scores[p.id]),
	});
	return {
		id: lobby.id,
		name: lobby.name,
		hostId: lobby.hostId,
		ruleset: lobby.ruleset,
		design: lobby.design,
		columns: lobby.columns,
		maxPlayers: lobby.maxPlayers,
		turnTimeout: lobby.turnTimeout,
		phase: lobby.phase,
		winners: lobby.winners,
		players: lobby.players.map(toPublic),
		spectators: lobby.spectators.map(toPublic),
		game: g
			? {
					order: g.order,
					names: g.names,
					currentPlayerId: g.order[g.turn]!,
					rollCount: g.rollCount,
					dice: g.dice,
					scores: g.scores,
					lastAction: g.lastAction,
					turnRemaining:
						g.turnDeadline === null
							? null
							: Math.max(0, g.turnDeadline - Date.now()),
				}
			: null,
	};
}

function broadcast(lobby: Lobby) {
	ns?.to(room(lobby.id)).emit("lobby:state", publicState(lobby));
}

function notify(lobby: Lobby, notice: Omit<LobbyNotice, "lobbyId">) {
	ns?.to(room(lobby.id)).emit("lobby:notice", { lobbyId: lobby.id, ...notice });
}

function membersChanged(lobby: Lobby) {
	for (const m of members(lobby))
		ns?.to(userRoom(m.id)).emit("lobbies:changed");
}

function idleDice(): DieState[] {
	return Array.from({ length: DICE_COUNT }, (_, i) => ({
		value: i + 1,
		held: false,
		pose: null,
	}));
}

function newLobbyId() {
	for (;;) {
		const id = Array.from(
			{ length: 5 },
			() => ID_ALPHABET[randomInt(ID_ALPHABET.length)],
		).join("");
		if (!lobbies.has(id)) return id;
	}
}

function fillSeats(lobby: Lobby) {
	if (lobby.phase === "playing") return;
	while (lobby.players.length < lobby.maxPlayers && lobby.spectators.length) {
		lobby.players.push(lobby.spectators.shift()!);
	}
	if (!isPlayer(lobby, lobby.hostId) && lobby.players[0])
		lobby.hostId = lobby.players[0].id;
}

function startGame(lobby: Lobby) {
	const ids = lobby.players.map((p) => p.id);
	const offset = lobby.rounds % ids.length;
	const order = [...ids.slice(offset), ...ids.slice(0, offset)];
	lobby.game = {
		order,
		names: Object.fromEntries(lobby.players.map((p) => [p.id, p.name])),
		turn: 0,
		rollCount: 0,
		dice: idleDice(),
		scores: Object.fromEntries(
			order.map((id) => [
				id,
				Array.from({ length: lobby.columns }, () => ({})),
			]),
		),
		rollingUntil: 0,
		lastAction: null,
		turnDeadline: null,
	};
	lobby.phase = "playing";
	lobby.winners = [];
	lobby.rounds++;
	checkAbandoned(lobby);
	armTurnTimer(lobby);
	membersChanged(lobby);
}

function resetTurn(game: Game) {
	game.rollCount = 0;
	game.dice = idleDice();
	game.rollingUntil = 0;
}

function nextTurn(lobby: Lobby) {
	const g = lobby.game!;
	g.turn = (g.turn + 1) % g.order.length;
	resetTurn(g);
	armTurnTimer(lobby);
	membersChanged(lobby);
}

function stopAbandonTimer(lobby: Lobby) {
	clearTimeout(abandonTimers.get(lobby.id));
	abandonTimers.delete(lobby.id);
}

function stopTurnTimer(lobby: Lobby) {
	clearTimeout(turnTimers.get(lobby.id));
	turnTimers.delete(lobby.id);
	if (lobby.game) lobby.game.turnDeadline = null;
}

function setTurnTimer(lobby: Lobby, deadline: number) {
	clearTimeout(turnTimers.get(lobby.id));
	lobby.game!.turnDeadline = deadline;
	turnTimers.set(
		lobby.id,
		setTimeout(
			() => {
				turnTimers.delete(lobby.id);
				onTurnTimeout(lobby).catch((err) =>
					console.error("[game] turn timeout failed", err),
				);
			},
			Math.max(0, deadline - Date.now()),
		),
	);
}

/** (Re)starts the move clock; after a roll it only starts once the dice have landed. */
function armTurnTimer(lobby: Lobby) {
	const g = lobby.game;
	if (lobby.phase !== "playing" || !g || lobby.turnTimeout <= 0) {
		stopTurnTimer(lobby);
		return;
	}
	setTurnTimer(
		lobby,
		Math.max(Date.now(), g.rollingUntil) + lobby.turnTimeout * 1000,
	);
}

function resumeTurnTimer(lobby: Lobby) {
	const deadline = lobby.game?.turnDeadline;
	if (lobby.phase === "playing" && deadline) setTurnTimer(lobby, deadline);
	else armTurnTimer(lobby);
}

/**
 * The current player ran out of time for this move: roll for them (keeping held dice)
 * and give them a fresh clock; once no roll is left, write the best field.
 */
async function onTurnTimeout(lobby: Lobby) {
	const g = lobby.game;
	if (lobbies.get(lobby.id) !== lobby || lobby.phase !== "playing" || !g)
		return;
	const playerId = g.order[g.turn]!;
	if (g.rollCount < MAX_ROLLS && !g.dice.every((d) => d.held)) {
		rollDice(lobby, g);
		armTurnTimer(lobby);
	} else {
		await scoreBest(lobby, g, playerId, "timeout");
	}
	touch(lobby);
	broadcast(lobby);
}

/** Writes the field that scores the most with the current dice. */
async function scoreBest(
	lobby: Lobby,
	game: Game,
	playerId: string,
	auto: AutoReason,
) {
	const rules = rulesetOf(lobby.ruleset);
	const move = bestMove(
		rules,
		game.scores[playerId]!,
		game.dice.map((d) => d.value),
		rules.hasServed && game.rollCount === 1,
	);
	if (move)
		await scoreField(lobby, game, playerId, move.column, move.category, auto);
	else nextTurn(lobby);
}

function rollDice(lobby: Lobby, game: Game) {
	const roll = simulateRoll(game.dice);
	roll.indices.forEach((dieIndex, k) => {
		game.dice[dieIndex] = {
			value: roll.values[k]!,
			held: false,
			pose: roll.poses[k]!,
		};
	});
	game.rollCount++;
	game.rollingUntil = Date.now() + ((roll.frames.length - 1) / roll.fps) * 1000;

	const animation: RollAnimation = {
		lobbyId: lobby.id,
		indices: roll.indices,
		frames: roll.frames,
		fps: roll.fps,
	};
	ns?.to(room(lobby.id)).emit("game:roll", animation);
}

async function scoreField(
	lobby: Lobby,
	game: Game,
	playerId: string,
	column: number,
	category: Category,
	auto?: AutoReason,
) {
	const rules = rulesetOf(lobby.ruleset);
	const sheetColumn = game.scores[playerId]![column]!;
	const served = rules.hasServed && game.rollCount === 1;
	const points = rules.score(
		category,
		game.dice.map((d) => d.value),
		served,
		sheetColumn,
	);
	sheetColumn[category] = points;
	game.lastAction = {
		playerId,
		column,
		category,
		points,
		served: served && points > 0 && !isUpper(category),
		auto,
	};

	if (game.order.every((id) => isSheetComplete(rules, game.scores[id]!)))
		await finishGame(lobby);
	else nextTurn(lobby);
}

function abortGame(lobby: Lobby, reason: LobbyNotice["code"]) {
	stopTurnTimer(lobby);
	lobby.game = null;
	lobby.phase = "waiting";
	lobby.winners = [];
	stopAbandonTimer(lobby);
	fillSeats(lobby);
	notify(lobby, { code: reason });
	membersChanged(lobby);
}

async function finishGame(lobby: Lobby) {
	const g = lobby.game!;
	const rules = rulesetOf(lobby.ruleset);
	const totals = g.order.map((id) => ({
		id,
		score: sheetTotal(rules, g.scores[id]),
	}));
	const best = Math.max(...totals.map((t) => t.score));
	lobby.phase = "finished";
	lobby.winners = totals.filter((t) => t.score === best).map((t) => t.id);
	stopAbandonTimer(lobby);
	stopTurnTimer(lobby);
	fillSeats(lobby);
	membersChanged(lobby);

	await recordGame(
		lobby,
		totals.map(({ id, score }) => ({
			userId: id,
			score,
			rank: 1 + totals.filter((t) => t.score > score).length,
			won: lobby.winners.includes(id),
		})),
	).catch((err) => console.error("[stats] failed to record game", err));
}

async function removeFromGame(lobby: Lobby, playerId: string) {
	const g = lobby.game;
	const index = g?.order.indexOf(playerId) ?? -1;
	if (lobby.phase !== "playing" || !g || index < 0) return;

	const wasCurrent = index === g.turn;
	g.order.splice(index, 1);
	delete g.scores[playerId];
	if (index < g.turn) g.turn--;

	if (g.order.length < MIN_PLAYERS) {
		abortGame(lobby, "notEnoughPlayers");
		return;
	}
	g.turn %= g.order.length;
	if (wasCurrent) {
		resetTurn(g);
		armTurnTimer(lobby);
	}
	const rules = rulesetOf(lobby.ruleset);
	if (g.order.every((id) => isSheetComplete(rules, g.scores[id]!)))
		await finishGame(lobby);
}

async function removeMember(lobby: Lobby, userId: string) {
	const name = nameOf(lobby, userId);
	membersChanged(lobby);
	await removeFromGame(lobby, userId);
	lobby.players = lobby.players.filter((p) => p.id !== userId);
	lobby.spectators = lobby.spectators.filter((p) => p.id !== userId);
	presence.get(lobby.id)?.delete(userId);
	if (members(lobby).length === 0) {
		removeLobby(lobby);
		return;
	}
	if (lobby.hostId === userId) lobby.hostId = lobby.players[0]?.id ?? "";
	fillSeats(lobby);
	notify(lobby, { code: "playerLeft", params: { name } });
	touch(lobby);
	broadcast(lobby);
}

function checkAbandoned(lobby: Lobby) {
	const anyoneOnline = lobby.players.some((p) => isOnline(lobby.id, p.id));
	if (lobby.phase !== "playing" || anyoneOnline) {
		stopAbandonTimer(lobby);
		return;
	}
	if (abandonTimers.has(lobby.id)) return;
	abandonTimers.set(
		lobby.id,
		setTimeout(() => {
			abandonTimers.delete(lobby.id);
			if (lobbies.get(lobby.id) !== lobby || lobby.phase !== "playing") return;
			abortGame(lobby, "abandoned");
			touch(lobby);
			broadcast(lobby);
		}, ABANDON_AFTER),
	);
}

function setPresence(
	socket: Socket,
	lobby: Lobby,
	userId: string,
	online: boolean,
) {
	let users = presence.get(lobby.id);
	if (!users) {
		users = new Map();
		presence.set(lobby.id, users);
	}
	let sockets = users.get(userId);
	if (!sockets) {
		sockets = new Set();
		users.set(userId, sockets);
	}
	if (online) sockets.add(socket.id);
	else sockets.delete(socket.id);
	checkAbandoned(lobby);
}

export function renamePlayer(userId: string, name: string) {
	for (const lobby of lobbies.values()) {
		const member = members(lobby).find((m) => m.id === userId);
		if (!member || member.name === name) continue;
		member.name = name;
		if (lobby.game?.names[userId]) lobby.game.names[userId] = name;
		touch(lobby);
		broadcast(lobby);
	}
}

function cleanText(value: unknown, field: string, max: number): string {
	const text = typeof value === "string" ? value.trim() : "";
	if (!text) throw new GameError("fieldMissing", { field });
	if (text.length > max) throw new GameError("fieldTooLong", { field, max });
	return text;
}

function intInRange(
	value: unknown,
	min: number,
	max: number,
	field: string,
): number {
	const n = Number(value);
	if (!Number.isInteger(n) || n < min || n > max)
		throw new GameError("fieldRange", { field, min, max });
	return n;
}

function turnTimeoutOf(value: unknown): number {
	const seconds = Number(value);
	if (!(TURN_TIMEOUTS as readonly number[]).includes(seconds))
		throw new GameError("INVALID_TIMEOUT");
	return seconds;
}

function findLobby(lobbyId: unknown): Lobby {
	const id = typeof lobbyId === "string" ? lobbyId.trim().toUpperCase() : "";
	const lobby = lobbies.get(id);
	if (!lobby) throw new GameError("NOT_FOUND");
	return lobby;
}

function memberLobby(lobbyId: unknown, userId: string): Lobby {
	const lobby = findLobby(lobbyId);
	if (!isMember(lobby, userId)) throw new GameError("NOT_MEMBER");
	return lobby;
}

function hostLobby(lobbyId: unknown, userId: string): Lobby {
	const lobby = memberLobby(lobbyId, userId);
	if (lobby.hostId !== userId) throw new GameError("HOST_ONLY");
	return lobby;
}

function playingLobby(
	lobbyId: unknown,
	userId: string,
): { lobby: Lobby; game: Game } {
	const lobby = memberLobby(lobbyId, userId);
	if (lobby.phase !== "playing" || !lobby.game) throw new GameError("NO_GAME");
	if (!lobby.game.order.includes(userId)) throw new GameError("NOT_IN_GAME");
	return { lobby, game: lobby.game };
}

function activeTurn(lobbyId: unknown, userId: string) {
	const { lobby, game } = playingLobby(lobbyId, userId);
	if (game.order[game.turn] !== userId) throw new GameError("NOT_YOUR_TURN");
	if (Date.now() < game.rollingUntil - 200)
		throw new GameError("STILL_ROLLING");
	return { lobby, game };
}

type Handler = (
	payload: Record<string, unknown>,
) => Promise<object | undefined> | object | undefined;

export function registerGameHandlers(socket: Socket, namespace: Namespace) {
	ns = namespace;
	const me = socket.data.userId as string;
	const viewing = new Set<string>();
	socket.join(userRoom(me));

	const on = (event: string, handler: Handler) => {
		socket.on(event, async (payload: unknown, ack?: (res: object) => void) => {
			try {
				await ensureLoaded();
				const data = await handler(
					(payload && typeof payload === "object" ? payload : {}) as Record<
						string,
						unknown
					>,
				);
				ack?.({ ok: true, ...data });
			} catch (err) {
				if (!(err instanceof GameError))
					console.error(`[socket] ${event} failed`, err);
				const known = err instanceof GameError;
				ack?.({
					ok: false,
					code: known ? err.code : "INTERNAL",
					params: known ? err.params : undefined,
				});
			}
		});
	};

	const myName = async () => (await getUser(me))?.name ?? "?";

	async function designFromPreset(
		presetId: unknown,
	): Promise<LobbyDesign | null> {
		if (presetId === null || presetId === undefined || presetId === "")
			return null;
		const preset =
			typeof presetId === "string" && /^[0-9a-f-]{36}$/.test(presetId)
				? await getUsablePreset(me, presetId)
				: null;
		if (!preset) throw new GameError("INVALID_PRESET");
		return { name: preset.name, layout: preset.layout };
	}

	on(
		"lobby:create",
		async ({
			name,
			password,
			ruleset,
			columns,
			maxPlayers,
			turnTimeout,
			presetId,
		}) => {
			if (!RULESET_IDS.includes(ruleset as RulesetId))
				throw new GameError("UNKNOWN_RULESET");
			const design = await designFromPreset(presetId);
			const id = newLobbyId();
			const lobby: Lobby = {
				id,
				name: cleanText(name, "lobbyName", 30),
				passwordHash: hashPassword(cleanText(password, "password", 64)),
				hostId: me,
				ruleset: ruleset as RulesetId,
				design,
				columns: intInRange(columns, 1, MAX_COLUMNS, "columns"),
				maxPlayers: intInRange(
					maxPlayers,
					MIN_PLAYERS,
					MAX_PLAYERS,
					"maxPlayers",
				),
				turnTimeout: turnTimeoutOf(turnTimeout ?? 0),
				phase: "waiting",
				players: [{ id: me, name: await myName() }],
				spectators: [],
				game: null,
				winners: [],
				rounds: 0,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			lobbies.set(id, lobby);
			touch(lobby);
			return { lobbyId: id };
		},
	);

	on("lobby:join", async ({ lobbyId, password }) => {
		const lobby = findLobby(lobbyId);
		if (isMember(lobby, me)) return { lobbyId: lobby.id };
		if (
			typeof password !== "string" ||
			!verifyPassword(password, lobby.passwordHash)
		)
			throw new GameError("WRONG_PASSWORD");
		const seat =
			lobby.phase !== "playing" && lobby.players.length < lobby.maxPlayers;
		(seat ? lobby.players : lobby.spectators).push({
			id: me,
			name: await myName(),
		});
		touch(lobby);
		broadcast(lobby);
		membersChanged(lobby);
		return { lobbyId: lobby.id, spectator: !seat };
	});

	on("lobby:enter", ({ lobbyId }) => {
		const lobby = memberLobby(lobbyId, me);
		socket.join(room(lobby.id));
		viewing.add(lobby.id);
		setPresence(socket, lobby, me, true);
		broadcast(lobby);
		return { state: publicState(lobby) };
	});

	on("lobby:exit", ({ lobbyId }) => {
		const lobby = lobbies.get(String(lobbyId));
		if (!lobby) return;
		socket.leave(room(lobby.id));
		viewing.delete(lobby.id);
		setPresence(socket, lobby, me, false);
		broadcast(lobby);
	});

	on("lobby:leave", async ({ lobbyId }) => {
		const lobby = memberLobby(lobbyId, me);
		socket.leave(room(lobby.id));
		viewing.delete(lobby.id);
		await removeMember(lobby, me);
	});

	on("lobby:kick", async ({ lobbyId, playerId }) => {
		const lobby = hostLobby(lobbyId, me);
		if (playerId === me || !isMember(lobby, String(playerId)))
			throw new GameError("INVALID_PLAYER");
		ns!
			.to(room(lobby.id))
			.emit("lobby:kicked", { lobbyId: lobby.id, playerId });
		await removeMember(lobby, playerId as string);
	});

	on("lobby:close", ({ lobbyId }) => {
		const lobby = hostLobby(lobbyId, me);
		if (lobby.phase !== "waiting") throw new GameError("ONLY_IN_WAITING_ROOM");
		membersChanged(lobby);
		ns!.to(room(lobby.id)).emit("lobby:closed", { lobbyId: lobby.id });
		removeLobby(lobby);
	});

	on("lobby:design", async ({ lobbyId, presetId }) => {
		const lobby = hostLobby(lobbyId, me);
		if (lobby.phase === "playing") throw new GameError("GAME_RUNNING");
		lobby.design = await designFromPreset(presetId);
		touch(lobby);
		broadcast(lobby);
	});

	on("lobby:start", ({ lobbyId }) => {
		const lobby = hostLobby(lobbyId, me);
		if (lobby.phase === "playing") throw new GameError("ALREADY_STARTED");
		if (lobby.players.length < MIN_PLAYERS)
			throw new GameError("MIN_PLAYERS", { min: MIN_PLAYERS });
		startGame(lobby);
		touch(lobby);
		broadcast(lobby);
	});

	on("lobby:timeout", ({ lobbyId, seconds }) => {
		const lobby = hostLobby(lobbyId, me);
		if (lobby.phase === "playing") throw new GameError("GAME_RUNNING");
		lobby.turnTimeout = turnTimeoutOf(seconds);
		touch(lobby);
		broadcast(lobby);
	});

	on("game:roll", ({ lobbyId }) => {
		const { lobby, game } = activeTurn(lobbyId, me);
		if (game.rollCount >= MAX_ROLLS) throw new GameError("NO_ROLLS_LEFT");
		if (game.dice.every((d) => d.held)) throw new GameError("ALL_HELD");

		rollDice(lobby, game);
		armTurnTimer(lobby);
		touch(lobby);
		broadcast(lobby);
	});

	on("game:hold", ({ lobbyId, index }) => {
		const { lobby, game } = activeTurn(lobbyId, me);
		if (game.rollCount === 0 || game.rollCount >= MAX_ROLLS)
			throw new GameError("CANNOT_HOLD");
		const die = game.dice[intInRange(index, 0, DICE_COUNT - 1, "die")]!;
		die.held = !die.held;
		touch(lobby);
		broadcast(lobby);
	});

	on("game:score", async ({ lobbyId, column, category }) => {
		const { lobby, game } = activeTurn(lobbyId, me);
		if (game.rollCount === 0) throw new GameError("MUST_ROLL_FIRST");
		const col = intInRange(column, 0, lobby.columns - 1, "column");
		const rules = rulesetOf(lobby.ruleset);
		if (!rules.categories.includes(category as Category))
			throw new GameError("UNKNOWN_FIELD");
		const cat = category as Category;
		if (game.scores[me]![col]![cat] !== undefined)
			throw new GameError("FIELD_TAKEN");

		await scoreField(lobby, game, me, col, cat);
		touch(lobby);
		broadcast(lobby);
	});

	on("game:skip", async ({ lobbyId }) => {
		const { lobby, game } = playingLobby(lobbyId, me);
		if (lobby.hostId !== me) throw new GameError("HOST_ONLY");
		const current = game.order[game.turn]!;
		if (current === me || isOnline(lobby.id, current))
			throw new GameError("ONLY_OFFLINE_SKIP");
		// the skipped player still gets an entry: roll their remaining rolls instantly and write the best field
		Object.assign(
			game,
			autoRollTurn(
				rulesetOf(lobby.ruleset),
				game.scores[current]!,
				game.dice,
				game.rollCount,
			),
		);
		await scoreBest(lobby, game, current, "skip");
		touch(lobby);
		broadcast(lobby);
	});

	on("lobby:mine", () => {
		const now = Date.now();
		const list: LobbySummary[] = [...lobbies.values()]
			.filter((l) => isMember(l, me))
			.filter(
				(l) => l.phase !== "finished" || now - l.updatedAt < RECENT_FINISHED,
			)
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.map((l) => ({
				id: l.id,
				name: l.name,
				phase: l.phase,
				ruleset: l.ruleset,
				role: isPlayer(l, me) ? "player" : "spectator",
				inGame: l.phase === "playing" && !!l.game?.order.includes(me),
				players: l.players.length,
				maxPlayers: l.maxPlayers,
				columns: l.columns,
				myTurn: l.phase === "playing" && l.game?.order[l.game.turn] === me,
				updatedAt: l.updatedAt,
			}));
		return { lobbies: list };
	});

	on("stats:get", async () => {
		const [stats, leaderboard] = await Promise.all([
			getStats(me),
			getLeaderboard(),
		]);
		return { me: stats, leaderboard };
	});

	socket.on("disconnect", () => {
		for (const lobbyId of viewing) {
			const lobby = lobbies.get(lobbyId);
			if (!lobby) continue;
			setPresence(socket, lobby, me, false);
			broadcast(lobby);
		}
	});
}
