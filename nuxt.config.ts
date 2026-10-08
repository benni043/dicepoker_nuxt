import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
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
		session: {
			maxAge: 60 * 60 * 24 * 30,
		},
	},
	i18n: {
		defaultLocale: "de",
		strategy: "prefix",
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
