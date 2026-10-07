<script setup lang="ts">
	import type { LobbyPhase, PublicPlayer } from "#shared/types";

	defineProps<{
		/** Players in turn order. */
		players: PublicPlayer[];
		spectators: PublicPlayer[];
		phase: LobbyPhase;
		currentPlayerId: string;
		winners: string[];
		meId: string;
		/** Show the remove button for offline players. */
		canKick: boolean;
	}>();

	const emit = defineEmits<{ kick: [playerId: string] }>();
</script>

<template>
	<div class="players-bar">
		<div
			v-for="p in players"
			:key="p.id"
			class="player-chip"
			:class="{
				active: phase === 'playing' && p.id === currentPlayerId,
				winner: phase === 'finished' && winners.includes(p.id),
			}"
		>
			<span class="dot" :class="{ on: p.connected }" />
			<span class="name">{{ p.name }}</span>
			<span class="total">{{ p.total }}</span>
			<button
				v-if="canKick && p.id !== meId && phase === 'playing' && !p.connected"
				type="button"
				class="link danger small"
				:title="$t('lobby.kick')"
				@click="emit('kick', p.id)"
			>
				✕
			</button>
		</div>
		<div
			v-if="spectators.length"
			class="player-chip watchers"
			:title="spectators.map((p) => p.name).join(', ')"
		>
			👁 {{ spectators.length }}
		</div>
	</div>
</template>

<style scoped>
	.players-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.player-chip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		background: var(--surface);
		border: 1px solid var(--border);
		transition:
			border-color 0.2s,
			background 0.2s;
	}
	.player-chip.active {
		border-color: var(--accent);
		background: rgba(74, 222, 128, 0.1);
		box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.12);
	}
	.player-chip.winner {
		border-color: var(--gold);
		background: rgba(251, 191, 36, 0.1);
	}
	.player-chip.watchers {
		color: var(--muted);
	}
	.name {
		font-weight: 600;
	}
	.total {
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		font-weight: 700;
	}
</style>
