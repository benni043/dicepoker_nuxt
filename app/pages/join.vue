<script setup lang="ts">
	const { call } = useGame();
	const { read } = useLocalizedQuery();
	const localePath = useLocalePath();
	const errorText = useErrorText();

	const form = reactive({
		lobbyId: read("id")?.toUpperCase() ?? "",
		password: "",
	});
	const error = ref("");
	const busy = ref(false);

	async function join() {
		busy.value = true;
		error.value = "";
		try {
			const { lobbyId } = await call<{ lobbyId: string }>("lobby:join", {
				lobbyId: form.lobbyId.trim().toUpperCase(),
				password: form.password,
			});
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
	<form class="card mx-auto my-12 max-w-[420px]" @submit.prevent="join">
		<h1>{{ $t("home.joinTitle") }}</h1>
		<label class="field">
			<span>{{ $t("fields.lobbyId") }}</span>
			<input
				v-model="form.lobbyId"
				class="input font-mono tracking-[0.2em] uppercase"
				maxlength="5"
				required
				placeholder="ABC12"
				autocomplete="off"
				v-focus="!form.lobbyId"
			>
		</label>
		<label class="field">
			<span>{{ $t("fields.password") }}</span>
			<input
				v-model="form.password"
				class="input"
				type="password"
				maxlength="64"
				required
				v-focus="!!form.lobbyId"
			>
		</label>
		<p v-if="error" class="my-2 text-danger">{{ error }}</p>
		<button
			type="submit"
			class="btn btn-primary w-full px-6 py-3 text-[1.05rem]"
			:disabled="busy"
		>
			{{ $t("home.join") }}
		</button>
	</form>
</template>
