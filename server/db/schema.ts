import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	googleSub: text("google_sub").notNull().unique(),
	email: text("email"),
	/** Display name, editable in the settings. */
	name: text("name").notNull(),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

/** Snapshot of a lobby (incl. running game) so games survive restarts. */
export const lobbies = pgTable("lobbies", {
	id: text("id").primaryKey(),
	data: jsonb("data").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const games = pgTable("games", {
	id: uuid("id").primaryKey().defaultRandom(),
	lobbyId: text("lobby_id").notNull(),
	lobbyName: text("lobby_name").notNull(),
	columns: integer("columns").notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const gamePlayers = pgTable(
	"game_players",
	{
		gameId: uuid("game_id")
			.notNull()
			.references(() => games.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		score: integer("score").notNull(),
		rank: integer("rank").notNull(),
		won: boolean("won").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.gameId, t.userId] }),
		index("game_players_user_idx").on(t.userId),
	],
);
