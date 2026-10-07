// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	future: { compatibilityVersion: 4 },
	compatibilityDate: "2025-05-15",
	devtools: { enabled: true },
	modules: ["@nuxtjs/i18n", "nuxt-auth-utils"],
	// Everything is realtime over socket.io; pages render on the client.
	ssr: false,
	css: ["~/assets/css/main.css"],
	app: {
		head: {
			title: "Dice Poker",
			meta: [{ name: "theme-color", content: "#0d0f14" }],
		},
	},
	runtimeConfig: {
		// NUXT_DATABASE_URL, e.g. postgres://user:pass@host:5432/db
		databaseUrl: "",
		// NUXT_MIGRATIONS_DIR; defaults to server/db/migrations in the project
		migrationsDir: "",
	},
	i18n: {
		defaultLocale: "de",
		// Language is part of every URL: /de/..., /en/...
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
			// Unprefixed links like /lobby/ABC12 redirect to the visitor's language.
			redirectOn: "no prefix",
			fallbackLocale: "de",
		},
	},
	vite: {
		// Pre-bundle up front; otherwise Vite discovers these at runtime and reloads the page.
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
		// Nuxt 4.6 imports its renderer via `nuxt/internal/*`; without inlining, the dev
		// server resolves the client manifest to an empty stub ("Either manifest or precomputed data…").
		externals: { inline: ["nuxt/internal"] },
	},
});
