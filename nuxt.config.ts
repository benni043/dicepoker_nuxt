import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
	future: { compatibilityVersion: 4 },
	compatibilityDate: "2025-05-15",
	devtools: { enabled: true },
	modules: ["@nuxtjs/i18n", "nuxt-auth-utils"],
	ssr: false,
	css: ["~/assets/css/main.css"],
	app: {
		head: {
			title: "Dice Poker",
			meta: [{ name: "theme-color", content: "#0d0f14" }],
		},
	},
	runtimeConfig: {
		databaseUrl: "",
		migrationsDir: "",
	},
	i18n: {
		defaultLocale: "de",
		strategy: "prefix",
		customRoutes: "config",
		pages: {
			login: { de: "/anmelden", en: "/login" },
			stats: { de: "/statistik", en: "/stats" },
			settings: { de: "/einstellungen", en: "/settings" },
			join: { de: "/beitreten", en: "/join" },
			"lobby/new": { de: "/lobby/neu", en: "/lobby/new" },
			"lobby/[id]": { de: "/lobby/[id]", en: "/lobby/[id]" },
		},
		locales: [
			{ code: "de", language: "de-DE", name: "Deutsch", file: "de.json" },
			{ code: "en", language: "en-US", name: "English", file: "en.json" },
		],
		detectBrowserLanguage: {
			useCookie: true,
			cookieKey: "i18n_locale",
			redirectOn: "no prefix",
			fallbackLocale: "de",
		},
	},
	vite: {
		plugins: [tailwindcss()],
		optimizeDeps: {
			include: [
				"three",
				"three/examples/jsm/geometries/RoundedBoxGeometry.js",
				"socket.io-client",
				"@vueuse/sound",
			],
		},
	},
	nitro: {
		externals: { inline: ["nuxt/internal"] },
	},
});
