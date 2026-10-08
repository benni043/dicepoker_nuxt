export type QueryKey = "redirect" | "notice" | "error" | "id";

const KEYS: Record<string, Record<QueryKey, string>> = {
	de: { redirect: "ziel", notice: "hinweis", error: "fehler", id: "id" },
	en: { redirect: "redirect", notice: "notice", error: "error", id: "id" },
};

const VALUES: Record<string, Record<string, string>> = {
	de: { kicked: "entfernt", closed: "aufgeloest", google: "google" },
	en: {},
};

export function localizedQuery(
	locale: string,
	params: Partial<Record<QueryKey, string>>,
): Record<string, string> {
	const keys = KEYS[locale] ?? KEYS.en!;
	return Object.fromEntries(
		Object.entries(params)
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => [keys[k as QueryKey], VALUES[locale]?.[v!] ?? v!]),
	);
}

export function readLocalizedQuery(
	query: Record<string, unknown>,
	key: QueryKey,
): string | undefined {
	for (const [locale, keys] of Object.entries(KEYS)) {
		const raw = query[keys[key]];
		const value = Array.isArray(raw) ? raw[0] : raw;
		if (typeof value !== "string") continue;
		const canonical = Object.entries(VALUES[locale] ?? {}).find(
			([, v]) => v === value,
		)?.[0];
		return canonical ?? value;
	}
	return undefined;
}
