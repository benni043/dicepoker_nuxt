<script setup lang="ts">
	import type { PublicPlayer } from "#shared/types";

	const props = defineProps<{
		/** Everyone who played the round (incl. players who left). */
		players: PublicPlayer[];
		winners: string[];
		meId: string;
		isHost: boolean;
		canStart: boolean;
	}>();

	const emit = defineEmits<{ start: [] }>();

	const { t } = useI18n();
	const localePath = useLocalePath();

	const ranking = computed(() =>
		[...props.players].sort((a, b) => b.total - a.total),
	);
	const headline = computed(() => {
		if (props.winners.length > 1) return t("lobby.results.tie");
		if (props.winners[0] === props.meId) return t("lobby.results.youWon");
		const winner = props.players.find((p) => p.id === props.winners[0]);
		return t("lobby.results.winner", { name: winner?.name ?? "?" });
	});
</script>

<template>
	<div class="card results">
		<h2>🏆 {{ headline }}</h2>
		<ol>
			<li v-for="p in ranking" :key="p.id" :class="{ me: p.id === meId }">
				<span>{{ p.name }}</span>
				<strong>{{ p.total }}</strong>
			</li>
		</ol>
		<div class="results-actions">
			<button
				v-if="isHost"
				type="button"
				class="btn btn-primary"
				:disabled="!canStart"
				@click="emit('start')"
			>
				{{ $t("lobby.results.newRound") }}
			</button>
			<p v-else class="muted small">
				{{ $t("lobby.results.newRoundHint") }}
			</p>
			<NuxtLink :to="localePath('stats')" class="btn btn-ghost">{{
				$t("nav.stats")
			}}</NuxtLink>
		</div>
	</div>
</template>

<style scoped>
	.results {
		padding: 1rem 1.25rem;
	}
	ol {
		margin: 0.25rem 0 0.75rem;
		padding-left: 1.25rem;
	}
	li {
		padding: 0.15rem 0;
	}
	li span {
		display: inline-block;
		min-width: 160px;
	}
	li.me {
		color: var(--accent);
	}
	.results-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
</style>
