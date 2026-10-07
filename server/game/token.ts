import { createHmac, timingSafeEqual } from "node:crypto";
import { useRuntimeConfig } from "nitropack/runtime";

// Short-lived token proving a socket connection belongs to a logged-in user.
const TTL_MS = 60_000;

function secret(): string {
	const password =
		useRuntimeConfig().session?.password || process.env.NUXT_SESSION_PASSWORD;
	if (!password) throw new Error("NUXT_SESSION_PASSWORD is not set");
	return password;
}

const sign = (payload: string) =>
	createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSocketToken(userId: string): string {
	const payload = Buffer.from(
		JSON.stringify({ uid: userId, exp: Date.now() + TTL_MS }),
	).toString("base64url");
	return `${payload}.${sign(payload)}`;
}

export function verifySocketToken(token: unknown): string | null {
	if (typeof token !== "string") return null;
	const [payload, signature] = token.split(".");
	if (!payload || !signature) return null;
	const expected = Buffer.from(sign(payload));
	const actual = Buffer.from(signature);
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
		return null;
	try {
		const { uid, exp } = JSON.parse(
			Buffer.from(payload, "base64url").toString(),
		);
		return typeof uid === "string" &&
			typeof exp === "number" &&
			exp > Date.now()
			? uid
			: null;
	} catch {
		return null;
	}
}
