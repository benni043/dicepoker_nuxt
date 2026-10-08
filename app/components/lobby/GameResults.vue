<script setup lang="ts">
	import type { PublicPlayer } from "#shared/types";

	const props = defineProps<{
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
	<div class="card px-5 py-4">
		<h2>🏆 {{ headline }}</h2>
		<ol class="mt-1 mb-3 list-decimal pl-5">
			<li
				v-for="p in ranking"
				:key="p.id"
				class="py-0.5"
				:class="{ 'text-accent': p.id === meId }"
			>
				<span class="inline-block min-w-40">{{ p.name }}</span>
				<strong>{{ p.total }}</strong>
			</li>
		</ol>
		<div class="flex items-center gap-3">
			<button
				v-if="isHost"
				type="button"
				class="btn btn-primary"
				:disabled="!canStart"
				@click="emit('start')"
			>
				{{ $t("lobby.results.newRound") }}
			</button>
			<p v-else class="text-sm text-muted">
				{{ $t("lobby.results.newRoundHint") }}
			</p>
			<NuxtLink :to="localePath('stats')" class="btn btn-ghost">
				{{ $t("nav.stats") }}
			</NuxtLink>
		</div>
	</div>
</template>
