import type { H3Event } from "h3";

const REDIRECT_COOKIE = "auth_redirect";
const LOCALES = ["de", "en"];
const DEFAULT_LOCALE = "de";

export function requestLocale(event: H3Event): string {
	const cookie = getCookie(event, "i18n_locale");
	if (cookie && LOCALES.includes(cookie)) return cookie;
	const header = getRequestHeader(event, "accept-language")
		?.slice(0, 2)
		.toLowerCase();
	return header && LOCALES.includes(header) ? header : DEFAULT_LOCALE;
}

const PAGE_PATHS: Record<string, Record<string, string>> = {
	"/login": { de: "/anmelden", en: "/login" },
};

export function localizedPath(event: H3Event, path: string): string {
	const locale = requestLocale(event);
	const translated = PAGE_PATHS[path]?.[locale] ?? path;
	return `/${locale}${translated === "/" ? "" : translated}`;
}

export function safeRedirect(event: H3Event, path: unknown): string {
	return typeof path === "string" &&
		path.startsWith("/") &&
		!path.startsWith("//") &&
		path !== "/"
		? path
		: localizedPath(event, "/");
}

export function rememberRedirect(event: H3Event) {
	const target = getQuery(event).redirect;
	if (target) {
		setCookie(event, REDIRECT_COOKIE, safeRedirect(event, target), {
			httpOnly: true,
			sameSite: "lax",
			maxAge: 600,
			path: "/",
		});
	}
}

export function consumeRedirect(event: H3Event): string {
	const target = safeRedirect(event, getCookie(event, REDIRECT_COOKIE));
	deleteCookie(event, REDIRECT_COOKIE, { path: "/" });
	return target;
}

export async function startSession(
	event: H3Event,
	user: { id: string; name: string; avatarUrl: string | null },
) {
	await setUserSession(event, {
		user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
		loggedInAt: Date.now(),
	});
}
