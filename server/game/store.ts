import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { desc, eq, inArray, sql } from "drizzle-orm";
import type { GameRecord, LeaderboardEntry, PlayerStats } from "#shared/types";
import { dbReady, schema, useDb } from "../db";

const { users, lobbies, games, gamePlayers } = schema;

export type UserRow = typeof users.$inferSelect;

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString("hex");
	return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(":");
	if (!salt || !hash) return false;
	const actual = scryptSync(password, salt, 32);
	const expected = Buffer.from(hash, "hex");
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function upsertGoogleUser(profile: {
	sub: string;
	email?: string;
	name: string;
	avatarUrl?: string;
}) {
	await dbReady();
	const [user] = await useDb()
		.insert(users)
		.values({
			googleSub: profile.sub,
			email: profile.email,
			name: profile.name.slice(0, 20),
			avatarUrl: profile.avatarUrl,
		})
		.onConflictDoUpdate({
			target: users.googleSub,
			set: {
				email: profile.email,
				avatarUrl: profile.avatarUrl,
				lastLoginAt: new Date(),
			},
		})
		.returning();
	return user!;
}

export async function getUser(id: string): Promise<UserRow | null> {
	await dbReady();
	const [user] = await useDb().select().from(users).where(eq(users.id, id));
	return user ?? null;
}

export async function updateUserName(id: string, name: string) {
	await dbReady();
	const [user] = await useDb()
		.update(users)
		.set({ name })
		.where(eq(users.id, id))
		.returning();
	return user ?? null;
}

export async function recordGame(
	lobby: { id: string; name: string; ruleset: string; columns: number },
	results: { userId: string; score: number; rank: number; won: boolean }[],
) {
	await dbReady();
	await useDb().transaction(async (tx) => {
		const [game] = await tx
			.insert(games)
			.values({
				lobbyId: lobby.id,
				lobbyName: lobby.name,
				ruleset: lobby.ruleset,
				columns: lobby.columns,
			})
			.returning({ id: games.id });
		await tx
			.insert(gamePlayers)
			.values(results.map((r) => ({ gameId: game!.id, ...r })));
	});
}

const aggregates = {
	games: sql<number>`count(${gamePlayers.gameId})::int`,
	wins: sql<number>`count(*) filter (where ${gamePlayers.won})::int`,
	bestScore: sql<number>`coalesce(max(${gamePlayers.score}), 0)::int`,
	totalScore: sql<number>`coalesce(sum(${gamePlayers.score}), 0)::int`,
};

export async function getStats(userId: string): Promise<PlayerStats | null> {
	await dbReady();
	const db = useDb();
	const user = await getUser(userId);
	if (!user) return null;

	const [totals] = await db
		.select(aggregates)
		.from(gamePlayers)
		.where(eq(gamePlayers.userId, userId));
	const mine = await db
		.select({
			gameId: games.id,
			lobbyName: games.lobbyName,
			finishedAt: games.finishedAt,
			score: gamePlayers.score,
			rank: gamePlayers.rank,
			won: gamePlayers.won,
		})
		.from(gamePlayers)
		.innerJoin(games, eq(games.id, gamePlayers.gameId))
		.where(eq(gamePlayers.userId, userId))
		.orderBy(desc(games.finishedAt))
		.limit(50);

	const tables = mine.length
		? await db
				.select({
					gameId: gamePlayers.gameId,
					name: users.name,
					score: gamePlayers.score,
				})
				.from(gamePlayers)
				.innerJoin(users, eq(users.id, gamePlayers.userId))
				.where(
					inArray(
						gamePlayers.gameId,
						mine.map((g) => g.gameId),
					),
				)
				.orderBy(desc(gamePlayers.score))
		: [];

	const history: GameRecord[] = mine.map((g) => ({
		...g,
		finishedAt: g.finishedAt.getTime(),
		players: tables
			.filter((t) => t.gameId === g.gameId)
			.map(({ name, score }) => ({ name, score })),
	}));

	return { id: user.id, name: user.name, ...totals!, history };
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
	await dbReady();
	return await useDb()
		.select({ id: users.id, name: users.name, ...aggregates })
		.from(gamePlayers)
		.innerJoin(users, eq(users.id, gamePlayers.userId))
		.groupBy(users.id)
		.orderBy(
			desc(aggregates.wins),
			desc(sql`count(*) filter (where ${gamePlayers.won})::float / count(*)`),
			desc(aggregates.bestScore),
		)
		.limit(limit);
}

export async function loadLobbyRecords<T>(): Promise<
	{ data: T; updatedAt: Date }[]
> {
	await dbReady();
	return (await useDb().select().from(lobbies)) as {
		data: T;
		updatedAt: Date;
	}[];
}

export async function saveLobbyRecord(id: string, data: unknown) {
	await dbReady();
	await useDb()
		.insert(lobbies)
		.values({ id, data, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: lobbies.id,
			set: { data, updatedAt: new Date() },
		});
}

export async function deleteLobbyRecord(id: string) {
	await dbReady();
	await useDb().delete(lobbies).where(eq(lobbies.id, id));
}
