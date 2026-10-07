import { localizedQuery, readLocalizedQuery } from "#shared/query";

export default defineNuxtRouteMiddleware((to) => {
	const { loggedIn } = useUserSession();
	const localePath = useLocalePath();
	const { $i18n } = useNuxtApp();
	const routeName = useRouteBaseName()(to);

	if (routeName === "login") {
		if (loggedIn.value)
			return navigateTo(
				readLocalizedQuery(to.query, "redirect") ?? localePath("index"),
			);
		return;
	}
	if (!loggedIn.value) {
		// The target URL's language, which may differ from the current one while switching.
		const prefix = to.path.split("/")[1] ?? "";
		const locale =
			$i18n.localeCodes.value.find((code) => code === prefix) ??
			$i18n.locale.value;
		const query =
			routeName === "index"
				? {}
				: localizedQuery(locale, { redirect: to.fullPath });
		return navigateTo(localePath({ name: "login", query }, locale));
	}
});
