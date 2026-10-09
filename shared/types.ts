import type { Category, RulesetId, ScoreColumn } from "./game";

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface Pose {
	p: Vec3;
	q: Quat;
}

export interface DieState {
	value: number;
	held: boolean;
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
	/** Set when the field was written automatically (time ran out / turn skipped). */
	auto?: AutoReason;
}

export type AutoReason = "timeout" | "skip";

export interface GameState {
	order: string[];
	names: Record<string, string>;
	currentPlayerId: string;
	rollCount: number;
	dice: DieState[];
	scores: Record<string, ScoreColumn[]>;
	lastAction: LastAction | null;
	/** Milliseconds until the current turn times out (null = no timer running). */
	turnRemaining: number | null;
}

export interface LobbyState {
	id: string;
	name: string;
	hostId: string;
	ruleset: RulesetId;
	columns: number;
	maxPlayers: number;
	/** Seconds a player has per move; 0 = no limit. */
	turnTimeout: number;
	phase: LobbyPhase;
	players: PublicPlayer[];
	spectators: PublicPlayer[];
	design: LobbyDesign | null;
	game: GameState | null;
	winners: string[];
}

export interface LobbySummary {
	id: string;
	name: string;
	phase: LobbyPhase;
	ruleset: RulesetId;
	role: "player" | "spectator";
	inGame: boolean;
	players: number;
	maxPlayers: number;
	columns: number;
	myTurn: boolean;
	updatedAt: number;
}

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

export type DiceLayout = (string | null)[][];

export interface DiceImage {
	id: string;
	name: string;
}

export interface DicePreset {
	id: string;
	name: string;
	layout: DiceLayout;
	isPublic: boolean;
}

export interface PublicDicePreset {
	id: string;
	name: string;
	owner: string;
	layout: DiceLayout;
	saved: boolean;
}

export interface DesignSettings {
	defaultPresetId: string | null;
	alwaysOwn: boolean;
}

export interface LobbyDesign {
	name: string;
	layout: DiceLayout;
}
