<script setup lang="ts">
	import type { LeaderboardEntry, PlayerStats } from "#shared/types";

	const { call, meId } = useGame();
	const { locale } = useI18n();
	const errorText = useErrorText();

	const stats = ref<PlayerStats | null>(null);
	const leaderboard = ref<LeaderboardEntry[]>([]);
	const error = ref("");

	const winRate = (wins: number, games: number) =>
		games ? Math.round((wins / games) * 100) : 0;
	const formatDate = (ts: number) =>
		new Date(ts).toLocaleString(locale.value, {
			day: "2-digit",
			month: "2-digit",
			year: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});

	onMounted(async () => {
		try {
			const res = await call<{
				me: PlayerStats | null;
				leaderboard: LeaderboardEntry[];
			}>("stats:get");
			stats.value = res.me;
			leaderboard.value = res.leaderboard;
		} catch (e) {
			error.value = errorText(e);
		}
	});

	const table =
		"w-full border-collapse text-sm [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted [&_th]:uppercase";
	const num = "text-right! tabular-nums";
</script>

<template>
	<div class="flex flex-col gap-5">
		<h1>{{ $t("stats.title") }}</h1>
		<p v-if="error" class="text-danger">{{ error }}</p>

		<section v-if="stats" class="card">
			<h2>{{ stats.name }}</h2>
			<div class="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
				<StatTile :value="stats.games" :label="$t('stats.games')" />
				<StatTile :value="stats.wins" :label="$t('stats.wins')" />
				<StatTile
					:value="`${winRate(stats.wins, stats.games)}%`"
					:label="$t('stats.winRate')"
				/>
				<StatTile :value="stats.bestScore" :label="$t('stats.best')" />
				<StatTile
					:value="stats.games ? Math.round(stats.totalScore / stats.games) : 0"
					:label="$t('stats.average')"
				/>
			</div>
		</section>

		<div
			class="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-5"
		>
			<section class="card">
				<h2>{{ $t("stats.recent") }}</h2>
				<table v-if="stats?.history.length" :class="table">
					<thead>
						<tr>
							<th>{{ $t("stats.date") }}</th>
							<th>{{ $t("stats.lobby") }}</th>
							<th :class="num">{{ $t("stats.rank") }}</th>
							<th :class="num">{{ $t("stats.points") }}</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="g in stats.history"
							:key="g.gameId"
							:title="g.players.map((p) => `${p.name}: ${p.score}`).join('\n')"
						>
							<td class="text-muted">{{ formatDate(g.finishedAt) }}</td>
							<td>{{ g.lobbyName }}</td>
							<td :class="num">
								<span v-if="g.won" class="badge">{{ $t("stats.win") }}</span>
								<span v-else>{{
									$t("stats.rankOf", { rank: g.rank, count: g.players.length })
								}}</span>
							</td>
							<td :class="num">{{ g.score }}</td>
						</tr>
					</tbody>
				</table>
				<p v-else class="text-muted">{{ $t("stats.noGames") }}</p>
			</section>

			<section class="card">
				<h2>{{ $t("stats.leaderboard") }}</h2>
				<table v-if="leaderboard.length" :class="table">
					<thead>
						<tr>
							<th>#</th>
							<th>{{ $t("stats.player") }}</th>
							<th :class="num">{{ $t("stats.wins") }}</th>
							<th :class="num">{{ $t("stats.games") }}</th>
							<th :class="num">{{ $t("stats.rate") }}</th>
							<th :class="num">{{ $t("stats.bestShort") }}</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="(p, i) in leaderboard"
							:key="p.id"
							:class="{ 'font-semibold text-accent': p.id === meId }"
						>
							<td class="text-muted">{{ i + 1 }}</td>
							<td>{{ p.name }}</td>
							<td :class="num">{{ p.wins }}</td>
							<td :class="num">{{ p.games }}</td>
							<td :class="num">{{ winRate(p.wins, p.games) }}%</td>
							<td :class="num">{{ p.bestScore }}</td>
						</tr>
					</tbody>
				</table>
				<p v-else class="text-muted">{{ $t("stats.noEntries") }}</p>
			</section>
		</div>
	</div>
</template>
