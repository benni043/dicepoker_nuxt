import {
	localizedQuery,
	type QueryKey,
	readLocalizedQuery,
} from "#shared/query";

export function useLocalizedQuery() {
	const { locale } = useI18n();
	const route = useRoute();
	return {
		query: (params: Partial<Record<QueryKey, string>>) =>
			localizedQuery(locale.value, params),
		read: (key: QueryKey) => readLocalizedQuery(route.query, key),
	};
}
