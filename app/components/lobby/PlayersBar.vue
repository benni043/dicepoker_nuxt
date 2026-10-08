<script setup lang="ts">
	import type { LobbyPhase, PublicPlayer } from "#shared/types";

	defineProps<{
		players: PublicPlayer[];
		spectators: PublicPlayer[];
		phase: LobbyPhase;
		currentPlayerId: string;
		winners: string[];
		meId: string;
		canKick: boolean;
	}>();

	const emit = defineEmits<{ kick: [playerId: string] }>();

	const chip =
		"flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 transition-colors";
</script>

<template>
	<div class="flex flex-wrap gap-2">
		<div
			v-for="p in players"
			:key="p.id"
			:class="[
				chip,
				phase === 'playing' && p.id === currentPlayerId
					? 'border-accent bg-accent/10 shadow-[0_0_0_3px_rgb(74_222_128/0.12)]'
					: phase === 'finished' && winners.includes(p.id)
						? 'border-gold bg-gold/10'
						: 'border-line',
			]"
		>
			<span class="dot" :class="{ 'dot-on': p.connected }" />
			<span class="font-semibold">{{ p.name }}</span>
			<span class="font-bold text-muted tabular-nums">{{ p.total }}</span>
			<button
				v-if="canKick && p.id !== meId && phase === 'playing' && !p.connected"
				type="button"
				class="link text-sm text-danger"
				:title="$t('lobby.kick')"
				@click="emit('kick', p.id)"
			>
				✕
			</button>
		</div>
		<div
			v-if="spectators.length"
			:class="chip"
			class="border-line text-muted"
			:title="spectators.map((p) => p.name).join(', ')"
		>
			👁 {{ spectators.length }}
		</div>
	</div>
</template>
