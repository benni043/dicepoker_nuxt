<script setup lang="ts">
	import { MAX_COLUMNS, MAX_PLAYERS, MIN_PLAYERS } from "#shared/game";

	const { call } = useGame();
	const { user } = useUserSession();
	const { t } = useI18n();
	const localePath = useLocalePath();
	const errorText = useErrorText();

	const form = reactive({
		name: t("home.defaultLobbyName", { name: user.value?.name }),
		password: "",
		columns: 3,
		maxPlayers: 4,
	});
	const error = ref("");
	const busy = ref(false);

	async function create() {
		busy.value = true;
		error.value = "";
		try {
			const { lobbyId } = await call<{ lobbyId: string }>("lobby:create", form);
			await navigateTo(
				localePath({ name: "lobby-id", params: { id: lobbyId } }),
			);
		} catch (e) {
			error.value = errorText(e);
		} finally {
			busy.value = false;
		}
	}
</script>

<template>
	<form class="card narrow" @submit.prevent="create">
		<h1>{{ $t("home.createTitle") }}</h1>
		<label class="field">
			<span>{{ $t("fields.lobbyName") }}</span>
			<input v-model="form.name" class="input" maxlength="30" required>
		</label>
		<label class="field">
			<span>{{ $t("fields.password") }}</span>
			<input
				v-model="form.password"
				class="input"
				type="password"
				maxlength="64"
				required
				autocomplete="new-password"
				v-focus
			>
		</label>
		<div class="row">
			<label class="field">
				<span>{{ $t("fields.columns") }}</span>
				<select v-model.number="form.columns" class="input">
					<option v-for="n in MAX_COLUMNS" :key="n" :value="n">{{ n }}</option>
				</select>
			</label>
			<label class="field">
				<span>{{ $t("fields.maxPlayers") }}</span>
				<select v-model.number="form.maxPlayers" class="input">
					<option
						v-for="n in MAX_PLAYERS - MIN_PLAYERS + 1"
						:key="n"
						:value="n + MIN_PLAYERS - 1"
					>
						{{ n + MIN_PLAYERS - 1 }}
					</option>
				</select>
			</label>
		</div>
		<p v-if="error" class="error">{{ error }}</p>
		<button
			type="submit"
			class="btn btn-primary btn-block btn-lg"
			:disabled="busy"
		>
			{{ $t("home.create") }}
		</button>
	</form>
</template>

<style scoped>
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
</style>
