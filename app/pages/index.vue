<script setup lang="ts">
	import { MAX_PLAYERS } from "#shared/game";
	import type { LobbySummary, PlayerStats } from "#shared/types";

	const { call } = useGame();
	const { user } = useUserSession();
	const localePath = useLocalePath();
	const route = useRoute();

	const notice = computed(() => {
		const value = queryString(route.query.notice);
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

	const actionCard =
		"card text-ink transition hover:-translate-y-0.5 hover:border-accent";
	const actionIcon =
		"mb-3 grid size-[42px] place-items-center rounded-[10px] bg-accent/12 text-[1.4rem] font-extrabold text-accent";
</script>

<template>
	<div>
		<p
			v-if="notice"
			class="mb-5 rounded-xl border border-gold/35 bg-gold/10 px-4 py-3 text-gold"
		>
			{{ $t(`home.notice.${notice}`) }}
		</p>

		<section class="mb-6">
			<h1>{{ $t("home.hello", { name: user?.name }) }} 👋</h1>
			<p class="text-muted">{{ $t("home.intro", { max: MAX_PLAYERS }) }}</p>
		</section>

		<div class="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
			<NuxtLink :to="localePath('lobby-new')" :class="actionCard">
				<span :class="actionIcon">＋</span>
				<h2>{{ $t("home.createTitle") }}</h2>
				<p class="text-muted">{{ $t("home.createText") }}</p>
			</NuxtLink>

			<NuxtLink :to="localePath('join')" :class="actionCard">
				<span :class="actionIcon">→</span>
				<h2>{{ $t("home.joinTitle") }}</h2>
				<p class="text-muted">{{ $t("home.joinText") }}</p>
			</NuxtLink>

			<div class="card">
				<div class="flex items-baseline justify-between">
					<h2>{{ $t("home.statsTitle") }}</h2>
					<NuxtLink :to="localePath('stats')" class="text-sm">
						{{ $t("home.statsDetails") }}
					</NuxtLink>
				</div>
				<div
					v-if="stats"
					class="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3"
				>
					<StatTile :value="stats.games" :label="$t('stats.games')" />
					<StatTile :value="stats.wins" :label="$t('stats.wins')" />
					<StatTile
						:value="`${stats.games ? Math.round((stats.wins / stats.games) * 100) : 0}%`"
						:label="$t('stats.winRate')"
					/>
				</div>
				<p v-else class="text-muted">{{ $t("common.loading") }}</p>
			</div>
		</div>

		<section v-if="myLobbies.length" class="card mt-5">
			<h2>{{ $t("home.myGames") }}</h2>
			<ul>
				<li
					v-for="l in myLobbies"
					:key="l.id"
					class="flex flex-wrap items-center justify-between gap-4 border-b border-line py-3 last:border-b-0"
				>
					<div>
						<strong>{{ l.name }}</strong>
						<span class="text-sm text-muted">
							· <code>{{ l.id }}</code> ·
							{{ $t(`rules.${l.ruleset}.name`) }}
							·
							{{
								$t("home.playerCount", { count: l.players, max: l.maxPlayers })
							}}
							·
							{{ $t("common.columns", l.columns) }}
						</span>
					</div>
					<div class="flex items-center gap-2">
						<span v-if="l.myTurn" class="badge badge-green">{{
							$t("home.yourTurn")
						}}</span>
						<span v-if="l.role === 'spectator'" class="badge badge-muted">
							👁 {{ $t("home.spectator") }}
						</span>
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
