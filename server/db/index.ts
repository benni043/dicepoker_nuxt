import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { useRuntimeConfig } from "nitropack/runtime";
import postgres from "postgres";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let migrated: Promise<void> | null = null;

export function useDb() {
	if (!db) {
		const url = useRuntimeConfig().databaseUrl;
		if (!url) throw new Error("NUXT_DATABASE_URL is not set");
		db = drizzle(postgres(url, { max: 10, onnotice: () => {} }), { schema });
	}
	return db;
}

/** Applies pending SQL migrations (generated with `pnpm db:generate`) once per process. */
export function dbReady(): Promise<void> {
	migrated ??= (async () => {
		const folder =
			useRuntimeConfig().migrationsDir ||
			resolve(process.cwd(), "server/db/migrations");
		await migrate(useDb(), { migrationsFolder: folder });
	})().catch((err) => {
		migrated = null; // retry on the next call, e.g. once the database is up
		throw err;
	});
	return migrated;
}

export { schema };
