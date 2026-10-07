<script setup lang="ts">
	import { useSound } from "@vueuse/sound";
	import {
		type Category,
		MAX_ROLLS,
		MIN_PLAYERS,
		sheetTotal,
	} from "#shared/game";
	import type { LobbyNotice, LobbyState, RollAnimation } from "#shared/types";
	import diceSfx from "~/assets/sounds/dice_rolling.mp3";
	import DiceScene from "~/components/DiceScene.vue";
	import { GameRequestError } from "~/composables/useGame";

	const route = useRoute();
	const router = useRouter();
	const lobbyId = String(route.params.id).toUpperCase();
	const { socket, meId, connected, call } = useGame();
	const { t } = useI18n();
	const localePath = useLocalePath();
	const { query: localQuery } = useLocalizedQuery();
	const home = (notice?: "kicked" | "closed") =>
		router.push(localePath({ name: "index", query: localQuery({ notice }) }));
	const errorText = useErrorText();
	const { play: playDiceSound } = useSound(diceSfx, { volume: 0.5 });

	const state = ref<LobbyState | null>(null);
	const status = ref<"loading" | "password" | "notfound" | "error" | "ready">(
		"loading",
	);
	const errorMsg = ref("");
	const actionError = ref("");
	const password = ref("");
	const busy = ref(false);
	const rolling = ref(false);
	const copied = ref(false);
	const toast = ref("");
	const sceneRef = ref<InstanceType<typeof DiceScene> | null>(null);
	let rollingFallback: ReturnType<typeof setTimeout> | undefined;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	// --- derived state ---
	const game = computed(() => state.value?.game ?? null);
	const isHost = computed(() => state.value?.hostId === meId.value);
	const inGame = computed(
		() => !!game.value && state.value?.phase !== "waiting",
	);
	const isSpectator = computed(
		() => !!state.value?.spectators.some((p) => p.id === meId.value),
	);
	const isInGame = computed(() => !!game.value?.order.includes(meId.value));
	// Players who left keep their name from the round's snapshot.
	const playerName = (id: string) =>
		[...(state.value?.players ?? []), ...(state.value?.spectators ?? [])].find(
			(p) => p.id === id,
		)?.name ??
		game.value?.names[id] ??
		"?";
	const orderedPlayers = computed(() => {
		const s = state.value;
		if (!s) return [];
		const order = s.game?.order ?? s.players.map((p) => p.id);
		return order.map(
			(id) =>
				s.players.find((p) => p.id === id) ?? {
					id,
					name: playerName(id),
					connected: false,
					total: s.game ? sheetTotal(s.game.scores[id]) : 0,
				},
		);
	});
	const currentPlayer = computed(
		() =>
			state.value?.players.find((p) => p.id === game.value?.currentPlayerId) ??
			null,
	);
	const isMyTurn = computed(
		() =>
			state.value?.phase === "playing" &&
			game.value?.currentPlayerId === meId.value,
	);
	const rollCount = computed(() => game.value?.rollCount ?? 0);
	const allHeld = computed(() => !!game.value?.dice.every((d) => d.held));
	const canRoll = computed(
		() =>
			isMyTurn.value &&
			!rolling.value &&
			rollCount.value < MAX_ROLLS &&
			!allHeld.value,
	);
	const canHold = computed(
		() =>
			isMyTurn.value &&
			!rolling.value &&
			rollCount.value > 0 &&
			rollCount.value < MAX_ROLLS,
	);
	const canPick = computed(
		() => isMyTurn.value && !rolling.value && rollCount.value > 0,
	);
	const diceValues = computed(
		() => game.value?.dice.map((d) => d.value) ?? [1, 2, 3, 4, 5],
	);
	/** Everyone with a score sheet this round. */
	const roundPlayers = computed(() =>
		orderedPlayers.value.filter((p) => game.value?.scores[p.id]),
	);
	// Unprefixed, so the invitee is redirected to their own language.
	const inviteUrl = computed(() => `${location.origin}/lobby/${lobbyId}`);

	const statusText = computed(() => {
		const s = state.value;
		if (s?.phase !== "playing" || !currentPlayer.value) return "";
		if (rolling.value) return t("lobby.status.rolling");
		if (isMyTurn.value) {
			if (rollCount.value === 0) return t("lobby.status.yourTurnStart");
			if (rollCount.value < MAX_ROLLS) return t("lobby.status.yourTurnHold");
			return t("lobby.status.yourTurnScore");
		}
		if (!currentPlayer.value.connected)
			return t("lobby.status.offline", { name: currentPlayer.value.name });
		return t("lobby.status.otherTurn", {
			name: currentPlayer.value.name,
			roll: rollCount.value,
			max: MAX_ROLLS,
		});
	});

	const lastActionText = computed(() => {
		const a = game.value?.lastAction;
		if (!a) return "";
		const params = {
			name: playerName(a.playerId),
			field: t(`categories.${a.category}`),
			column: a.column + 1,
			points: a.points,
		};
		if (a.points === 0) return t("lobby.lastAction.struck", params);
		return (
			t("lobby.lastAction.scored", params, a.points) +
			(a.served ? ` – ${t("lobby.lastAction.served")}` : "")
		);
	});

	// Lock page scrolling on desktop while the board is shown (see main.css).
	useHead({
		htmlAttrs: { class: computed(() => (inGame.value ? "game-active" : "")) },
	});

	function showToast(text: string) {
		toast.value = text;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast.value = ""), 5000);
	}

	// --- server communication ---
	async function enter() {
		try {
			const res = await call<{ state: LobbyState }>("lobby:enter", { lobbyId });
			state.value = res.state;
			status.value = "ready";
		} catch (e) {
			const code = e instanceof GameRequestError ? e.code : "";
			status.value =
				code === "NOT_MEMBER"
					? "password"
					: code === "NOT_FOUND"
						? "notfound"
						: "error";
			errorMsg.value = code === "NOT_MEMBER" ? "" : errorText(e);
		}
	}

	async function join() {
		busy.value = true;
		errorMsg.value = "";
		try {
			await call("lobby:join", { lobbyId, password: password.value });
			await enter();
		} catch (e) {
			errorMsg.value = errorText(e);
		} finally {
			busy.value = false;
		}
	}

	async function action(event: string, payload: object = {}) {
		actionError.value = "";
		try {
			await call(event, { lobbyId, ...payload });
			return true;
		} catch (e) {
			actionError.value = errorText(e);
			return false;
		}
	}

	const start = () => action("lobby:start");
	const roll = () => action("game:roll");
	const skip = () => action("game:skip");
	const kick = (playerId: string) => action("lobby:kick", { playerId });

	function toggleHold(index: number) {
		if (canHold.value) action("game:hold", { index });
	}

	function pick(column: number, category: Category, points: number) {
		if (
			points === 0 &&
			!confirm(
				t("lobby.strikeConfirm", {
					field: t(`categories.${category}`),
					column: column + 1,
				}),
			)
		)
			return;
		action("game:score", { column, category });
	}

	async function leave() {
		if (
			state.value?.phase === "playing" &&
			isInGame.value &&
			!confirm(t("lobby.leaveGameConfirm"))
		)
			return;
		if (await action("lobby:leave")) home();
	}

	async function closeLobby() {
		if (confirm(t("lobby.closeConfirm")) && (await action("lobby:close")))
			home();
	}

	async function copyInvite() {
		try {
			await navigator.clipboard.writeText(inviteUrl.value);
			copied.value = true;
			setTimeout(() => (copied.value = false), 2000);
		} catch {
			prompt(t("lobby.copyInvite"), inviteUrl.value);
		}
	}

	// --- realtime events ---
	function onState(next: LobbyState) {
		if (next.id === lobbyId) state.value = next;
	}

	function onRoll(anim: RollAnimation) {
		if (anim.lobbyId !== lobbyId) return;
		rolling.value = true;
		playDiceSound();
		sceneRef.value?.playRoll(anim);
		// In case the scene is not mounted or the tab is in the background.
		clearTimeout(rollingFallback);
		rollingFallback = setTimeout(
			onSettled,
			((anim.frames.length - 1) / anim.fps) * 1000 + 600,
		);
	}

	function onSettled() {
		clearTimeout(rollingFallback);
		rolling.value = false;
	}

	function onNotice(notice: LobbyNotice) {
		if (notice.lobbyId === lobbyId)
			showToast(t(`lobby.notice.${notice.code}`, notice.params ?? {}));
	}

	function onKicked({
		lobbyId: id,
		playerId,
	}: {
		lobbyId: string;
		playerId: string;
	}) {
		if (id === lobbyId && playerId === meId.value) home("kicked");
	}

	function onClosed({ lobbyId: id }: { lobbyId: string }) {
		if (id === lobbyId && !isHost.value) home("closed");
	}

	socket.on("lobby:state", onState);
	socket.on("game:roll", onRoll);
	socket.on("lobby:notice", onNotice);
	socket.on("lobby:kicked", onKicked);
	socket.on("lobby:closed", onClosed);

	// (Re-)enter whenever the socket (re-)connects.
	watch(connected, (ok) => ok && enter(), { immediate: true });

	watch(isMyTurn, (mine) => {
		document.title = mine
			? `▶ ${t("lobby.yourTurnTitle")} – Dice Poker`
			: "Dice Poker";
	});

	onBeforeUnmount(() => {
		socket.off("lobby:state", onState);
		socket.off("game:roll", onRoll);
		socket.off("lobby:notice", onNotice);
		socket.off("lobby:kicked", onKicked);
		socket.off("lobby:closed", onClosed);
		clearTimeout(rollingFallback);
		clearTimeout(toastTimer);
		document.title = "Dice Poker";
		if (status.value === "ready") socket.emit("lobby:exit", { lobbyId });
	});
</script>

<template>
	<div class="lobby-page" :class="{ 'in-game': inGame }">
		<p v-if="status === 'loading'" class="muted center">
			{{ $t("lobby.connecting", { id: lobbyId }) }}
		</p>

		<div v-else-if="status === 'notfound'" class="card narrow">
			<h2>{{ $t("lobby.notFoundTitle") }}</h2>
			<p class="muted">{{ $t("lobby.notFoundText", { id: lobbyId }) }}</p>
			<NuxtLink :to="localePath('index')" class="btn">{{
				$t("common.toHome")
			}}</NuxtLink>
		</div>

		<form
			v-else-if="status === 'password'"
			class="card narrow"
			@submit.prevent="join"
		>
			<h2>{{ $t("lobby.joinTitle", { id: lobbyId }) }}</h2>
			<label class="field">
				<span>{{ $t("fields.password") }}</span>
				<input
					v-model="password"
					class="input"
					type="password"
					required
					v-focus
				>
			</label>
			<p v-if="errorMsg" class="error">{{ errorMsg }}</p>
			<button type="submit" class="btn btn-primary btn-block" :disabled="busy">
				{{ $t("home.join") }}
			</button>
		</form>

		<div v-else-if="status === 'error'" class="card narrow">
			<p class="error">{{ errorMsg }}</p>
			<button type="button" class="btn" @click="enter">
				{{ $t("common.retry") }}
			</button>
		</div>

		<template v-else-if="state">
			<header class="lobby-head">
				<div class="title">
					<h1>{{ state.name }}</h1>
					<p class="muted small">
						ID <code>{{ state.id }}</code> ·
						{{ $t("common.columns", state.columns) }} ·
						<button type="button" class="link" @click="copyInvite">
							{{ copied ? $t("lobby.copied") : $t("lobby.copyInvite") }}
						</button>
					</p>
				</div>
				<div class="head-actions">
					<button
						type="button"
						v-if="isHost && state.phase === 'waiting'"
						class="btn btn-ghost danger"
						@click="closeLobby"
					>
						{{ $t("lobby.close") }}
					</button>
					<button type="button" class="btn btn-ghost" @click="leave">
						{{ $t("lobby.leave") }}
					</button>
				</div>
			</header>

			<p v-if="actionError" class="error">{{ actionError }}</p>
			<p v-if="isSpectator" class="spectator-note">
				👁 {{ $t("lobby.spectatorNote") }}
			</p>

			<LobbyWaitingRoom
				v-if="state.phase === 'waiting'"
				:state="state"
				:me-id="meId"
				:copied="copied"
				@start="start"
				@kick="kick"
				@copy-invite="copyInvite"
			/>

			<section v-else-if="game" class="game-layout">
				<div class="board">
					<LobbyPlayersBar
						:players="orderedPlayers"
						:spectators="state.spectators"
						:phase="state.phase"
						:current-player-id="game.currentPlayerId"
						:winners="state.winners"
						:me-id="meId"
						:can-kick="isHost"
						@kick="kick"
					/>

					<LobbyGameResults
						v-if="state.phase === 'finished'"
						:players="roundPlayers"
						:winners="state.winners"
						:me-id="meId"
						:is-host="isHost"
						:can-start="state.players.length >= MIN_PLAYERS"
						@start="start"
					/>

					<div class="scene-wrap">
						<DiceScene
							ref="sceneRef"
							fill
							:dice="game.dice"
							:interactive="canHold"
							@toggle="toggleHold"
							@settled="onSettled"
						/>
					</div>

					<div v-if="state.phase === 'playing'" class="controls">
						<DiceTray
							:values="diceValues"
							:held="game.dice.map((d) => d.held)"
							:revealed="rollCount > 0 && !rolling"
							:clickable="canHold"
							@toggle="toggleHold"
						/>
						<button
							type="button"
							class="btn btn-primary btn-lg roll-btn"
							:disabled="!canRoll"
							@click="roll"
						>
							{{ $t("lobby.roll") }}
							<span class="roll-count">{{ rollCount }}/{{ MAX_ROLLS }}</span>
						</button>
					</div>

					<div v-if="state.phase === 'playing'" class="status">
						<p :class="{ mine: isMyTurn }">{{ statusText }}</p>
						<button
							type="button"
							v-if="currentPlayer && !currentPlayer.connected && !isMyTurn"
							class="btn btn-ghost"
							@click="skip"
						>
							{{ $t("lobby.skip") }}
						</button>
					</div>
					<p v-if="lastActionText" class="muted small last-action">
						{{ lastActionText }}
					</p>
				</div>

				<div class="card sheet">
					<ScoreSheet
						:players="roundPlayers"
						:columns="state.columns"
						:scores="game.scores"
						:current-player-id="state.phase === 'playing' ? game.currentPlayerId : null"
						:me-id="meId"
						:pickable="canPick"
						:dice="diceValues"
						:served="rollCount === 1"
						:last-action="game.lastAction"
						@pick="pick"
					/>
				</div>
			</section>
		</template>

		<Transition name="toast">
			<div v-if="toast" class="toast" role="status">{{ toast }}</div>
		</Transition>
	</div>
</template>

<style scoped>
	.center {
		text-align: center;
		margin-top: 3rem;
	}
	.lobby-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}
	.lobby-head h1 {
		margin-bottom: 0.15rem;
	}
	.head-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.btn.danger {
		color: var(--danger);
	}

	.spectator-note {
		background: rgba(96, 165, 250, 0.1);
		border: 1px solid rgba(96, 165, 250, 0.35);
		color: #93c5fd;
		border-radius: var(--radius);
		padding: 0.55rem 0.9rem;
		margin: 0 0 1rem;
	}

	.game-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
	}
	.board {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.scene-wrap {
		aspect-ratio: 4 / 3;
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.roll-btn {
		min-width: 170px;
	}
	.roll-count {
		font-size: 0.85rem;
		opacity: 0.7;
	}
	.status {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-height: 2.25rem;
	}
	.status p {
		margin: 0;
		color: var(--muted);
	}
	.status p.mine {
		color: var(--accent);
		font-weight: 600;
	}
	.last-action {
		margin: 0;
	}

	.sheet {
		padding: 0.75rem;
	}

	/* Desktop: the whole game fits the viewport, nothing scrolls except the sheet. */
	@media (min-width: 1001px) {
		.lobby-page.in-game {
			height: calc(100dvh - var(--header-h) - 3rem);
			display: flex;
			flex-direction: column;
		}
		.in-game .game-layout {
			flex: 1;
			min-height: 0;
			align-items: stretch;
		}
		.in-game .board {
			min-height: 0;
		}
		.in-game .scene-wrap {
			flex: 1;
			min-height: 160px;
			aspect-ratio: auto;
		}
		.in-game .sheet {
			min-height: 0;
			overflow: auto;
		}
	}
	@media (max-width: 1000px) {
		.game-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 600px) {
		.controls {
			justify-content: center;
		}
		.roll-btn {
			width: 100%;
		}
	}
</style>
