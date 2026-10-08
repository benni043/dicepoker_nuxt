<script setup lang="ts">
	const { loggedIn, user } = useUserSession();
	const { locale } = useI18n();
	const localePath = useLocalePath();

	useHead({ htmlAttrs: { lang: locale } });

	const navLink =
		"font-semibold text-muted hover:text-ink [&.router-link-active]:text-ink";
</script>

<template>
	<div class="flex min-h-screen flex-col">
		<header
			class="sticky top-0 z-10 flex h-header items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6"
		>
			<NuxtLink
				:to="localePath('index')"
				class="flex items-center gap-2 text-lg font-extrabold text-ink"
			>
				<span class="text-2xl leading-none text-accent">⚄</span>
				Dice Poker
			</NuxtLink>
			<nav v-if="loggedIn && user" class="flex items-center gap-5">
				<NuxtLink
					:to="localePath('lobby-new')"
					:class="navLink"
					class="hidden sm:inline"
				>
					{{ $t("nav.newLobby") }}
				</NuxtLink>
				<NuxtLink
					:to="localePath('join')"
					:class="navLink"
					class="hidden sm:inline"
				>
					{{ $t("nav.join") }}
				</NuxtLink>
				<NuxtLink :to="localePath('stats')" :class="navLink">
					{{ $t("nav.stats") }}
				</NuxtLink>
				<NuxtLink
					:to="localePath('settings')"
					:title="$t('nav.settings')"
					class="flex items-center gap-2 rounded-full border border-line bg-surface-2 p-0.5 text-ink sm:pr-3.5 [&.router-link-active]:border-accent"
				>
					<img
						v-if="user.avatarUrl"
						:src="user.avatarUrl"
						alt=""
						class="size-7 rounded-full"
						referrerpolicy="no-referrer"
					>
					<span
						v-else
						class="grid size-7 place-items-center rounded-full bg-accent text-sm font-extrabold text-accent-ink"
					>
						{{ user.name.charAt(0).toUpperCase() }}
					</span>
					<span class="hidden sm:inline">{{ user.name }}</span>
				</NuxtLink>
			</nav>
		</header>
		<ActiveGameBar v-if="loggedIn" />

		<main class="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">
			<NuxtPage />
		</main>
	</div>
</template>
