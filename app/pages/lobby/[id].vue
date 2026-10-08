<script setup lang="ts">
	import { useSound } from "@vueuse/sound";
	import {
		type Category,
		MAX_ROLLS,
		MIN_PLAYERS,
		rulesetOf,
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
	const home = (notice?: "kicked" | "closed") =>
		router.push(localePath({ name: "index", query: notice ? { notice } : {} }));
	const errorText = useErrorText();
	const { play: playDiceSound } = useSound(diceSfx, { volume: 0.5 });
	const { layoutFor, load: loadDesigns } = useDiceDesigns();
	onMounted(loadDesigns);

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
	const boardRef = ref<HTMLElement | null>(null);
	const sheetRef = ref<HTMLElement | null>(null);

	const isSingleColumn = () => window.matchMedia("(max-width: 1023px)").matches;
	function scrollTo(el: HTMLElement | null) {
		if (el && isSingleColumn())
			el.scrollIntoView({ behavior: "smooth", block: "start" });
	}
	let rollingFallback: ReturnType<typeof setTimeout> | undefined;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const game = computed(() => state.value?.game ?? null);
	const skin = computed(() => layoutFor(state.value?.design));
	const isHost = computed(() => state.value?.hostId === meId.value);
	const inGame = computed(
		() => !!game.value && state.value?.phase !== "waiting",
	);
	const isSpectator = computed(
		() => !!state.value?.spectators.some((p) => p.id === meId.value),
	);
	const isInGame = computed(() => !!game.value?.order.includes(meId.value));
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
					total: s.game
						? sheetTotal(rulesetOf(s.ruleset), s.game.scores[id])
						: 0,
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
	const roundPlayers = computed(() =>
		orderedPlayers.value.filter((p) => game.value?.scores[p.id]),
	);
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

	useHead({
		htmlAttrs: {
			class: computed(() => (inGame.value ? "lg:overflow-hidden" : "")),
		},
	});

	function showToast(text: string) {
		toast.value = text;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast.value = ""), 5000);
	}

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

	async function pick(column: number, category: Category, points: number) {
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
		if (await action("game:score", { column, category }))
			scrollTo(boardRef.value);
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

	function onState(next: LobbyState) {
		if (next.id === lobbyId) state.value = next;
	}

	function onRoll(anim: RollAnimation) {
		if (anim.lobbyId !== lobbyId) return;
		rolling.value = true;
		playDiceSound();
		sceneRef.value?.playRoll(anim);
		clearTimeout(rollingFallback);
		rollingFallback = setTimeout(
			onSettled,
			((anim.frames.length - 1) / anim.fps) * 1000 + 600,
		);
	}

	function onSettled() {
		clearTimeout(rollingFallback);
		rolling.value = false;
		if (isMyTurn.value && rollCount.value >= MAX_ROLLS)
			scrollTo(sheetRef.value);
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

	watch(connected, (ok) => ok && enter(), { immediate: true });

	watch(isMyTurn, (mine) => {
		document.title = mine
			? `▶ ${t("lobby.yourTurnTitle")} – Dice Poker`
			: "Dice Poker";
		if (mine) nextTick(() => scrollTo(boardRef.value));
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
	<div
		:class="inGame ? 'lg:flex lg:h-[calc(100dvh-var(--spacing-header)-3rem)] lg:flex-col' : ''"
	>
		<p v-if="status === 'loading'" class="mt-12 text-center text-muted">
			{{ $t("lobby.connecting", { id: lobbyId }) }}
		</p>

		<div
			v-else-if="status === 'notfound'"
			class="card mx-auto my-12 max-w-[420px]"
		>
			<h2>{{ $t("lobby.notFoundTitle") }}</h2>
			<p class="mb-4 text-muted">
				{{ $t("lobby.notFoundText", { id: lobbyId }) }}
			</p>
			<NuxtLink :to="localePath('index')" class="btn">
				{{ $t("common.toHome") }}
			</NuxtLink>
		</div>

		<form
			v-else-if="status === 'password'"
			class="card mx-auto my-12 max-w-[420px]"
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
			<p v-if="errorMsg" class="my-2 text-danger">{{ errorMsg }}</p>
			<button type="submit" class="btn btn-primary w-full" :disabled="busy">
				{{ $t("home.join") }}
			</button>
		</form>

		<div
			v-else-if="status === 'error'"
			class="card mx-auto my-12 max-w-[420px]"
		>
			<p class="mb-4 text-danger">{{ errorMsg }}</p>
			<button type="button" class="btn" @click="enter">
				{{ $t("common.retry") }}
			</button>
		</div>

		<template v-else-if="state">
			<header
				class="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1"
			>
				<h1 class="mb-0 text-xl wrap-break-word sm:text-[1.6rem]">
					{{ state.name }}
				</h1>
				<div class="flex gap-2">
					<button
						v-if="isHost && state.phase === 'waiting'"
						type="button"
						class="btn btn-ghost px-3 py-1.5 text-sm text-danger"
						@click="closeLobby"
					>
						{{ $t("lobby.close") }}
					</button>
					<button
						type="button"
						class="btn btn-ghost px-3 py-1.5 text-sm"
						@click="leave"
					>
						{{ $t("lobby.leave") }}
					</button>
				</div>
				<p class="col-span-2 text-sm text-muted">
					ID <code>{{ state.id }}</code> ·
					{{ $t(`rules.${state.ruleset}.name`) }} ·
					{{ $t("common.columns", state.columns) }} ·
					<button type="button" class="link" @click="copyInvite">
						{{ copied ? $t("lobby.copied") : $t("lobby.copyInvite") }}
					</button>
				</p>
			</header>

			<p v-if="actionError" class="my-2 text-danger">{{ actionError }}</p>
			<p
				v-if="isSpectator"
				class="mb-4 rounded-xl border border-info/35 bg-info/10 px-3.5 py-2 text-info"
			>
				👁 {{ $t("lobby.spectatorNote") }}
			</p>
			<LobbyDesignPicker
				v-if="state.phase !== 'playing'"
				:design="state.design"
				:is-host="isHost"
				@change="(presetId) => action('lobby:design', { presetId })"
			/>

			<LobbyWaitingRoom
				v-if="state.phase === 'waiting'"
				:state="state"
				:me-id="meId"
				:copied="copied"
				@start="start"
				@kick="kick"
				@copy-invite="copyInvite"
			/>

			<section
				v-else-if="game"
				class="grid grid-cols-1 items-start gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-stretch"
			>
				<div
					ref="boardRef"
					class="flex scroll-mt-[calc(var(--spacing-header)+0.75rem)] flex-col gap-3.5 lg:min-h-0"
				>
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

					<div class="aspect-4/3 lg:aspect-auto lg:min-h-40 lg:flex-1">
						<DiceScene
							ref="sceneRef"
							fill
							:dice="game.dice"
							:interactive="canHold"
							:skin="skin"
							@toggle="toggleHold"
							@settled="onSettled"
						/>
					</div>

					<div
						v-if="state.phase === 'playing'"
						class="flex flex-wrap items-center justify-center gap-4 sm:justify-between"
					>
						<DiceTray
							:values="diceValues"
							:held="game.dice.map((d) => d.held)"
							:revealed="rollCount > 0 && !rolling"
							:clickable="canHold"
							:skin="skin"
							@toggle="toggleHold"
						/>
						<button
							type="button"
							class="btn btn-primary w-full px-6 py-3 text-[1.05rem] sm:w-auto sm:min-w-[170px]"
							:disabled="!canRoll"
							@click="roll"
						>
							{{ $t("lobby.roll") }}
							<span class="text-sm opacity-70"
								>{{ rollCount }}/{{ MAX_ROLLS }}</span
							>
						</button>
					</div>

					<div
						v-if="state.phase === 'playing'"
						class="flex min-h-9 items-center gap-4"
					>
						<p :class="isMyTurn ? 'font-semibold text-accent' : 'text-muted'">
							{{ statusText }}
						</p>
						<button
							v-if="currentPlayer && !currentPlayer.connected && !isMyTurn"
							type="button"
							class="btn btn-ghost"
							@click="skip"
						>
							{{ $t("lobby.skip") }}
						</button>
					</div>
					<p v-if="lastActionText" class="text-sm text-muted">
						{{ lastActionText }}
					</p>
				</div>

				<div
					ref="sheetRef"
					class="card scroll-mt-[calc(var(--spacing-header)+0.75rem)] p-3 lg:min-h-0 lg:overflow-auto"
				>
					<ScoreSheet
						:players="roundPlayers"
						:ruleset="state.ruleset"
						:columns="state.columns"
						:scores="game.scores"
						:current-player-id="state.phase === 'playing' ? game.currentPlayerId : null"
						:me-id="meId"
						:pickable="canPick"
						:dice="diceValues"
						:served="rulesetOf(state.ruleset).hasServed && rollCount === 1"
						:last-action="game.lastAction"
						@pick="pick"
					/>
				</div>
			</section>
		</template>

		<Transition
			enter-active-class="transition duration-200"
			leave-active-class="transition duration-200"
			enter-from-class="translate-y-2.5 opacity-0"
			leave-to-class="translate-y-2.5 opacity-0"
		>
			<div
				v-if="toast"
				class="fixed bottom-6 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[10px] border border-line bg-surface-3 px-5 py-3 shadow-card"
				role="status"
			>
				{{ toast }}
			</div>
		</Transition>
	</div>
</template>
