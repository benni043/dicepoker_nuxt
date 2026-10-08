<script setup lang="ts">
	import { MIN_PLAYERS } from "#shared/game";
	import type { LobbyState } from "#shared/types";

	const props = defineProps<{
		state: LobbyState;
		meId: string;
		copied: boolean;
	}>();

	const emit = defineEmits<{
		start: [];
		kick: [playerId: string];
		copyInvite: [];
	}>();

	const isHost = computed(() => props.state.hostId === props.meId);

	const row = "flex items-center gap-2.5 border-b border-line py-2.5";
	const kickButton = "link ml-auto text-sm text-danger";
</script>

<template>
	<section
		class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-5"
	>
		<div class="card">
			<h2>
				{{
					$t("lobby.players", {
						count: state.players.length,
						max: state.maxPlayers,
					})
				}}
			</h2>
			<ul class="mb-5">
				<li v-for="p in state.players" :key="p.id" :class="row">
					<span class="dot" :class="{ 'dot-on': p.connected }" />
					<span class="font-semibold">{{ p.name }}</span>
					<span v-if="p.id === state.hostId" class="badge">{{
						$t("lobby.host")
					}}</span>
					<span v-if="p.id === meId" class="badge badge-muted">{{
						$t("lobby.you")
					}}</span>
					<button
						v-if="isHost && p.id !== meId"
						type="button"
						:class="kickButton"
						@click="emit('kick', p.id)"
					>
						{{ $t("lobby.kick") }}
					</button>
				</li>
			</ul>
			<template v-if="isHost">
				<button
					type="button"
					class="btn btn-primary w-full px-6 py-3 text-[1.05rem]"
					:disabled="state.players.length < MIN_PLAYERS"
					@click="emit('start')"
				>
					{{ $t("lobby.start") }}
				</button>
				<p
					v-if="state.players.length < MIN_PLAYERS"
					class="mt-2 text-sm text-muted"
				>
					{{ $t("lobby.minPlayers", { min: MIN_PLAYERS }) }}
				</p>
			</template>
			<p v-else class="text-muted">{{ $t("lobby.waitForHost") }}</p>

			<template v-if="state.spectators.length">
				<h3 class="mt-5 text-[0.95rem] text-muted">
					{{ $t("lobby.spectators", { count: state.spectators.length }) }}
				</h3>
				<ul>
					<li v-for="p in state.spectators" :key="p.id" :class="row">
						<span class="dot" :class="{ 'dot-on': p.connected }" />
						<span class="font-semibold">{{ p.name }}</span>
						<span v-if="p.id === meId" class="badge badge-muted">{{
							$t("lobby.you")
						}}</span>
						<button
							v-if="isHost"
							type="button"
							:class="kickButton"
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
			<p class="text-muted">{{ $t("lobby.inviteText") }}</p>
			<div
				class="py-4 text-center font-mono text-[2.4rem] font-extrabold tracking-[0.3em] text-accent"
			>
				{{ state.id }}
			</div>
			<button type="button" class="btn w-full" @click="emit('copyInvite')">
				{{ copied ? $t("lobby.copied") : $t("lobby.copyInvite") }}
			</button>
		</div>
	</section>
</template>
