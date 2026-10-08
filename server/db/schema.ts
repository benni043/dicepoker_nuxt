import {
	type AnyPgColumn,
	boolean,
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import type { DiceLayout } from "#shared/types";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType: () => "bytea",
});

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	googleSub: text("google_sub").notNull().unique(),
	email: text("email"),
	name: text("name").notNull(),
	avatarUrl: text("avatar_url"),
	defaultPresetId: uuid("default_preset_id").references(
		(): AnyPgColumn => dicePresets.id,
		{ onDelete: "set null" },
	),
	alwaysOwnDesign: boolean("always_own_design").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

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
	ruleset: text("ruleset").notNull().default("poker"),
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

export const diceImages = pgTable(
	"dice_images",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		mime: text("mime").notNull(),
		data: bytea("data").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [index("dice_images_user_idx").on(t.userId)],
);

export const dicePresets = pgTable(
	"dice_presets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		layout: jsonb("layout").$type<DiceLayout>().notNull(),
		isPublic: boolean("is_public").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("dice_presets_user_idx").on(t.userId),
		index("dice_presets_public_idx").on(t.isPublic),
	],
);
