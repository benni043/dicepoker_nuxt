import { upsertGoogleUser } from "../../../game/store";

const handler = defineOAuthGoogleEventHandler({
	config: { scope: ["openid", "email", "profile"] },
	async onSuccess(event, { user: profile }) {
		const user = await upsertGoogleUser({
			sub: profile.sub,
			email: profile.email,
			name: profile.given_name || profile.name || "Player",
			avatarUrl: profile.picture,
		});
		await startSession(event, user);
		return sendRedirect(event, consumeRedirect(event));
	},
	onError(event, error) {
		console.error("[auth] Google login failed", error);
		return sendRedirect(
			event,
			`${localizedPath(event, "/login")}?error=google`,
		);
	},
});

export default defineEventHandler((event) => {
	if (!getQuery(event).code) rememberRedirect(event);
	return handler(event);
});
