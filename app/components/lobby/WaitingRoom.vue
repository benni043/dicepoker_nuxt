<script setup lang="ts">
	import { MIN_PLAYERS } from "#shared/game";
	import type { LobbyState } from "#shared/types";

	const props = defineProps<{
		state: LobbyState;
		meId: string;
		/** The invite link was just copied. */
		copied: boolean;
	}>();

	const emit = defineEmits<{
		start: [];
		kick: [playerId: string];
		copyInvite: [];
	}>();

	const isHost = computed(() => props.state.hostId === props.meId);
</script>

<template>
	<section class="waiting">
		<div class="card">
			<h2>
				{{
					$t("lobby.players", {
						count: state.players.length,
						max: state.maxPlayers,
					})
				}}
			</h2>
			<ul class="player-list">
				<li v-for="p in state.players" :key="p.id">
					<span class="dot" :class="{ on: p.connected }" />
					<span class="name">{{ p.name }}</span>
					<span v-if="p.id === state.hostId" class="badge">{{
						$t("lobby.host")
					}}</span>
					<span v-if="p.id === meId" class="badge badge-muted">{{
						$t("lobby.you")
					}}</span>
					<button
						v-if="isHost && p.id !== meId"
						type="button"
						class="link danger small kick"
						@click="emit('kick', p.id)"
					>
						{{ $t("lobby.kick") }}
					</button>
				</li>
			</ul>
			<template v-if="isHost">
				<button
					type="button"
					class="btn btn-primary btn-lg btn-block"
					:disabled="state.players.length < MIN_PLAYERS"
					@click="emit('start')"
				>
					{{ $t("lobby.start") }}
				</button>
				<p v-if="state.players.length < MIN_PLAYERS" class="muted small">
					{{ $t("lobby.minPlayers", { min: MIN_PLAYERS }) }}
				</p>
			</template>
			<p v-else class="muted">{{ $t("lobby.waitForHost") }}</p>

			<template v-if="state.spectators.length">
				<h3 class="spectators-title">
					{{ $t("lobby.spectators", { count: state.spectators.length }) }}
				</h3>
				<ul class="player-list">
					<li v-for="p in state.spectators" :key="p.id">
						<span class="dot" :class="{ on: p.connected }" />
						<span class="name">{{ p.name }}</span>
						<span v-if="p.id === meId" class="badge badge-muted">{{
							$t("lobby.you")
						}}</span>
						<button
							v-if="isHost"
							type="button"
							class="link danger small kick"
							@click="emit('kick', p.id)"
						>
							{{ $t("lobby.kick") }}
						</button>
					</li>
				</ul>
			</template>
		</div>
		<div class="card">
			<h2>{{ $t("lobby.inviteTitle") }}</h2>
			<p class="muted">{{ $t("lobby.inviteText") }}</p>
			<div class="invite-id">{{ state.id }}</div>
			<button type="button" class="btn btn-block" @click="emit('copyInvite')">
				{{ copied ? $t("lobby.copied") : $t("lobby.copyInvite") }}
			</button>
		</div>
	</section>
</template>

<style scoped>
	.waiting {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.25rem;
		align-items: start;
	}
	.player-list {
		list-style: none;
		padding: 0;
		margin: 0 0 1.25rem;
	}
	.player-list li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--border);
	}
	.player-list .name {
		font-weight: 600;
	}
	.kick {
		margin-left: auto;
	}
	.spectators-title {
		font-size: 0.95rem;
		color: var(--muted);
		margin-top: 1.25rem;
	}
	.invite-id {
		font-family: "JetBrains Mono", ui-monospace, monospace;
		font-size: 2.4rem;
		font-weight: 800;
		letter-spacing: 0.3em;
		text-align: center;
		padding: 1rem 0;
		color: var(--accent);
	}
</style>
