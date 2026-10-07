<script setup lang="ts">
	const { loggedIn, user } = useUserSession();
	const { locale } = useI18n();
	const localePath = useLocalePath();

	useHead({ htmlAttrs: { lang: locale } });
</script>

<template>
	<div class="app">
		<header class="topbar">
			<NuxtLink :to="localePath('index')" class="brand">
				<span class="brand-die">⚄</span>
				Dice Poker
			</NuxtLink>
			<nav v-if="loggedIn && user">
				<NuxtLink :to="localePath('lobby-new')" class="nav-link optional">{{
					$t("nav.newLobby")
				}}</NuxtLink>
				<NuxtLink :to="localePath('join')" class="nav-link optional">{{
					$t("nav.join")
				}}</NuxtLink>
				<NuxtLink :to="localePath('stats')" class="nav-link">{{
					$t("nav.stats")
				}}</NuxtLink>
				<NuxtLink
					:to="localePath('settings')"
					class="me"
					:title="$t('nav.settings')"
				>
					<img
						v-if="user.avatarUrl"
						:src="user.avatarUrl"
						alt=""
						class="avatar"
						referrerpolicy="no-referrer"
					>
					<span v-else class="avatar placeholder">{{
						user.name.charAt(0).toUpperCase()
					}}</span>
					<span class="me-name">{{ user.name }}</span>
				</NuxtLink>
			</nav>
		</header>
		<ActiveGameBar v-if="loggedIn" />

		<main class="content">
			<NuxtPage />
		</main>
	</div>
</template>

<style scoped>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.topbar {
		height: var(--header-h);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.5rem;
		border-bottom: 1px solid var(--border);
		background: rgba(13, 15, 20, 0.85);
		backdrop-filter: blur(8px);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.brand {
		font-weight: 800;
		font-size: 1.15rem;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.brand-die {
		color: var(--accent);
		font-size: 1.5rem;
		line-height: 1;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}
	.nav-link {
		color: var(--muted);
		font-weight: 600;
	}
	.nav-link:hover,
	.nav-link.router-link-active {
		color: var(--text);
	}
	.me {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: 999px;
		padding: 0.2rem 0.85rem 0.2rem 0.2rem;
	}
	.me.router-link-active {
		border-color: var(--accent);
	}
	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
	}
	.avatar.placeholder {
		display: grid;
		place-items: center;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 800;
		font-size: 0.85rem;
	}
	.content {
		flex: 1;
		width: 100%;
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem;
	}
	@media (max-width: 600px) {
		.topbar,
		.content {
			padding-left: 1rem;
			padding-right: 1rem;
		}
		.me-name,
		.nav-link.optional {
			display: none;
		}
	}
</style>
