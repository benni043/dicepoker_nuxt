import type { Category, ScoreColumn } from "./game";

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface Pose {
	p: Vec3;
	q: Quat;
}

export interface DieState {
	value: number;
	held: boolean;
	/** Resting pose inside the arena after the last roll; null = idle row. */
	pose: Pose | null;
}

export type LobbyPhase = "waiting" | "playing" | "finished";

export interface PublicPlayer {
	id: string;
	name: string;
	connected: boolean;
	total: number;
}

export interface LastAction {
	playerId: string;
	column: number;
	category: Category;
	points: number;
	served: boolean;
}

export interface GameState {
	order: string[];
	/** Name snapshot of everyone who started the round (incl. players who left). */
	names: Record<string, string>;
	currentPlayerId: string;
	rollCount: number;
	dice: DieState[];
	scores: Record<string, ScoreColumn[]>;
	lastAction: LastAction | null;
}

export interface LobbyState {
	id: string;
	name: string;
	hostId: string;
	columns: number;
	maxPlayers: number;
	phase: LobbyPhase;
	players: PublicPlayer[];
	spectators: PublicPlayer[];
	game: GameState | null;
	winners: string[];
}

export interface LobbySummary {
	id: string;
	name: string;
	phase: LobbyPhase;
	role: "player" | "spectator";
	/** I am a player in the currently running game. */
	inGame: boolean;
	players: number;
	maxPlayers: number;
	columns: number;
	myTurn: boolean;
	updatedAt: number;
}

/** Pre-simulated roll: frames hold [x,y,z,qx,qy,qz,qw] for each die in `indices`. */
export interface RollAnimation {
	lobbyId: string;
	indices: number[];
	frames: number[][];
	fps: number;
}

export interface GameRecord {
	gameId: string;
	lobbyName: string;
	finishedAt: number;
	score: number;
	rank: number;
	won: boolean;
	players: { name: string; score: number }[];
}

export interface PlayerStats {
	id: string;
	name: string;
	games: number;
	wins: number;
	bestScore: number;
	totalScore: number;
	history: GameRecord[];
}

export interface LeaderboardEntry {
	id: string;
	name: string;
	games: number;
	wins: number;
	bestScore: number;
}

export interface LobbyNotice {
	lobbyId: string;
	code: "playerLeft" | "notEnoughPlayers" | "abandoned";
	params?: Record<string, string | number>;
}
