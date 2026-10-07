<script setup lang="ts">
	import type { LobbySummary } from "#shared/types";

	// Shown on every page except the lobby itself while one of my games is running.
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
			// keep the last known list
		}
	}

	// Debounced: turn changes can arrive in quick succession.
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
	<div v-if="running.length" class="game-bar">
		<div
			v-for="l in running.slice(0, 2)"
			:key="l.id"
			class="game-bar-item"
			:class="{ turn: l.myTurn }"
		>
			<span class="pulse" />
			<span class="text">
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
				class="btn btn-primary btn-sm"
			>
				{{ $t("gameBar.back") }}
			</NuxtLink>
		</div>
	</div>
</template>

<style scoped>
	.game-bar {
		position: sticky;
		top: var(--header-h);
		z-index: 9;
		background: #10261a;
		border-bottom: 1px solid rgba(74, 222, 128, 0.3);
	}
	.game-bar-item {
		max-width: 1400px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.45rem 1.5rem;
		font-size: 0.9rem;
	}
	.game-bar-item + .game-bar-item {
		border-top: 1px solid rgba(74, 222, 128, 0.15);
	}
	.text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		flex-shrink: 0;
		animation: pulse 1.6s infinite;
	}
	.turn .pulse {
		background: var(--gold);
	}
	@keyframes pulse {
		50% {
			opacity: 0.3;
		}
	}
	.btn-sm {
		padding: 0.3rem 0.8rem;
		font-size: 0.85rem;
	}
	@media (max-width: 600px) {
		.game-bar-item {
			padding: 0.45rem 1rem;
		}
	}
</style>
