import {
	localizedQuery,
	type QueryKey,
	readLocalizedQuery,
} from "#shared/query";

export function useLocalizedQuery() {
	const { locale } = useI18n();
	const route = useRoute();
	return {
		/** Query object with localized parameter names, e.g. { ziel: "/de/lobby/X" }. */
		query: (params: Partial<Record<QueryKey, string>>) =>
			localizedQuery(locale.value, params),
		/** Reads a parameter of the current route, whatever language it was written in. */
		read: (key: QueryKey) => readLocalizedQuery(route.query, key),
	};
}
