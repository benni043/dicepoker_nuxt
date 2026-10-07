import { dbReady } from "../db";

export default defineNitroPlugin(() => {
	dbReady()
		.then(() => console.log("[db] migrations applied"))
		.catch((err) =>
			console.error(
				"[db] migration failed – is the database running?",
				err.message ?? err,
			),
		);
});
