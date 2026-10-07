<script setup lang="ts">
	import { MAX_PLAYERS } from "#shared/game";
	import type { LobbySummary, PlayerStats } from "#shared/types";

	const { call } = useGame();
	const { user } = useUserSession();
	const localePath = useLocalePath();
	const { read } = useLocalizedQuery();

	const notice = computed(() => {
		const value = read("notice");
		return value === "kicked" || value === "closed" ? value : "";
	});
	const myLobbies = ref<LobbySummary[]>([]);
	const stats = ref<PlayerStats | null>(null);

	onMounted(async () => {
		const [mine, s] = await Promise.all([
			call<{ lobbies: LobbySummary[] }>("lobby:mine"),
			call<{ me: PlayerStats | null }>("stats:get"),
		]);
		myLobbies.value = mine.lobbies;
		stats.value = s.me;
	});
</script>

<template>
	<div class="home">
		<p v-if="notice" class="notice">{{ $t(`home.notice.${notice}`) }}</p>

		<section class="hero">
			<h1>{{ $t("home.hello", { name: user?.name }) }} 👋</h1>
			<p class="muted">{{ $t("home.intro", { max: MAX_PLAYERS }) }}</p>
		</section>

		<div class="grid">
			<NuxtLink :to="localePath('lobby-new')" class="card action">
				<span class="action-icon">＋</span>
				<h2>{{ $t("home.createTitle") }}</h2>
				<p class="muted">{{ $t("home.createText") }}</p>
			</NuxtLink>

			<NuxtLink :to="localePath('join')" class="card action">
				<span class="action-icon">→</span>
				<h2>{{ $t("home.joinTitle") }}</h2>
				<p class="muted">{{ $t("home.joinText") }}</p>
			</NuxtLink>

			<div class="card">
				<div class="card-head">
					<h2>{{ $t("home.statsTitle") }}</h2>
					<NuxtLink :to="localePath('stats')" class="small">{{
						$t("home.statsDetails")
					}}</NuxtLink>
				</div>
				<div v-if="stats" class="stat-tiles">
					<div class="stat-tile">
						<div class="value">{{ stats.games }}</div>
						<div class="label">{{ $t("stats.games") }}</div>
					</div>
					<div class="stat-tile">
						<div class="value">{{ stats.wins }}</div>
						<div class="label">{{ $t("stats.wins") }}</div>
					</div>
					<div class="stat-tile">
						<div class="value">
							{{
								stats.games ? Math.round((stats.wins / stats.games) * 100) : 0
							}}%
						</div>
						<div class="label">{{ $t("stats.winRate") }}</div>
					</div>
				</div>
				<p v-else class="muted">{{ $t("common.loading") }}</p>
			</div>
		</div>

		<section v-if="myLobbies.length" class="card mine">
			<h2>{{ $t("home.myGames") }}</h2>
			<ul>
				<li v-for="l in myLobbies" :key="l.id">
					<div>
						<strong>{{ l.name }}</strong>
						<span class="muted small">
							· <code>{{ l.id }}</code> ·
							{{
								$t("home.playerCount", { count: l.players, max: l.maxPlayers })
							}}
							·
							{{ $t("common.columns", l.columns) }}
						</span>
					</div>
					<div class="mine-actions">
						<span v-if="l.myTurn" class="badge badge-green">{{
							$t("home.yourTurn")
						}}</span>
						<span v-if="l.role === 'spectator'" class="badge badge-muted"
							>👁 {{ $t("home.spectator") }}</span
						>
						<span class="badge badge-muted">{{ $t(`phase.${l.phase}`) }}</span>
						<NuxtLink
							:to="localePath({ name: 'lobby-id', params: { id: l.id } })"
							class="btn"
						>
							{{
								l.phase === "playing" ? $t("home.continue") : $t("home.open")
							}}
						</NuxtLink>
					</div>
				</li>
			</ul>
		</section>
	</div>
</template>

<style scoped>
	.notice {
		background: rgba(251, 191, 36, 0.1);
		border: 1px solid rgba(251, 191, 36, 0.35);
		color: var(--gold);
		border-radius: var(--radius);
		padding: 0.7rem 1rem;
		margin: 0 0 1.25rem;
	}
	.hero {
		margin-bottom: 1.5rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.25rem;
		align-items: stretch;
	}
	.action {
		color: var(--text);
		transition:
			border-color 0.15s,
			transform 0.15s;
	}
	.action:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
	}
	.action p {
		margin: 0;
	}
	.action-icon {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 10px;
		background: rgba(74, 222, 128, 0.12);
		color: var(--accent);
		font-size: 1.4rem;
		font-weight: 800;
		margin-bottom: 0.75rem;
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.mine {
		margin-top: 1.25rem;
	}
	.mine ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.mine li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}
	.mine li:last-child {
		border-bottom: none;
	}
	.mine-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
</style>
