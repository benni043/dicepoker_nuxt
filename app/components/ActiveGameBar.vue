<script setup lang="ts">
	import type { LobbySummary } from "#shared/types";

	const { socket, connected, call } = useGame();
	const route = useRoute();
	const localePath = useLocalePath();
	const getRouteBaseName = useRouteBaseName();

	const lobbies = ref<LobbySummary[]>([]);
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;

	const currentLobbyId = computed(() =>
		getRouteBaseName(route) === "lobby-id"
			? String(route.params.id).toUpperCase()
			: null,
	);
	const running = computed(() =>
		lobbies.value
			.filter((l) => l.phase === "playing" && l.id !== currentLobbyId.value)
			.sort(
				(a, b) =>
					Number(b.myTurn) - Number(a.myTurn) ||
					Number(b.inGame) - Number(a.inGame),
			),
	);

	async function refresh() {
		try {
			lobbies.value = (
				await call<{ lobbies: LobbySummary[] }>("lobby:mine")
			).lobbies;
		} catch {
			return;
		}
	}

	function scheduleRefresh() {
		clearTimeout(refreshTimer);
		refreshTimer = setTimeout(refresh, 300);
	}

	socket.on("lobbies:changed", scheduleRefresh);
	watch(connected, (ok) => ok && refresh(), { immediate: true });
	watch(() => route.fullPath, scheduleRefresh);

	onBeforeUnmount(() => {
		socket.off("lobbies:changed", scheduleRefresh);
		clearTimeout(refreshTimer);
	});
</script>

<template>
	<div
		v-if="running.length"
		class="sticky top-header z-9 border-b border-accent/30 bg-bar"
	>
		<div
			v-for="l in running.slice(0, 2)"
			:key="l.id"
			class="mx-auto flex max-w-[87.5rem] items-center gap-3 px-4 py-2 text-sm not-first:border-t not-first:border-accent/15 sm:px-6"
		>
			<span
				class="size-2 shrink-0 animate-pulse rounded-full"
				:class="l.myTurn ? 'bg-gold' : 'bg-accent'"
			/>
			<span class="min-w-0 flex-1 truncate">
				{{
					l.inGame
						? $t("gameBar.playing", { name: l.name })
						: $t("gameBar.watching", { name: l.name })
				}}
			</span>
			<span v-if="l.myTurn" class="badge badge-green">{{
				$t("home.yourTurn")
			}}</span>
			<NuxtLink
				:to="localePath({ name: 'lobby-id', params: { id: l.id } })"
				class="btn btn-primary px-3 py-1 text-sm"
			>
				{{ $t("gameBar.back") }}
			</NuxtLink>
		</div>
	</div>
</template>
