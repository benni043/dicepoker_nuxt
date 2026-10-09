<script setup lang="ts">
	import {
		MAX_COLUMNS,
		MAX_PLAYERS,
		MIN_PLAYERS,
		RULESET_IDS,
		type RulesetId,
		TURN_TIMEOUTS,
	} from "#shared/game";

	const { call } = useGame();
	const { user } = useUserSession();
	const { t } = useI18n();
	const localePath = useLocalePath();
	const errorText = useErrorText();
	const { settings, load } = useDiceDesigns();

	const form = reactive({
		name: t("home.defaultLobbyName", { name: user.value?.name }),
		password: "",
		ruleset: "poker" as RulesetId,
		columns: 3,
		maxPlayers: 4,
		turnTimeout: 0,
		presetId: "",
	});

	onMounted(async () => {
		await load();
		form.presetId = settings.value.defaultPresetId ?? "";
	});

	const DEFAULT_COLUMNS: Record<RulesetId, number> = { poker: 3, kniffel: 1 };
	watch(
		() => form.ruleset,
		(ruleset) => (form.columns = DEFAULT_COLUMNS[ruleset]),
	);
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
	<form class="card mx-auto my-12 max-w-[26.25rem]" @submit.prevent="create">
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
		<fieldset class="field">
			<legend class="mb-1.5">{{ $t("fields.ruleset") }}</legend>
			<div class="grid grid-cols-2 gap-2">
				<label
					v-for="id in RULESET_IDS"
					:key="id"
					class="cursor-pointer rounded-lg border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-accent/15"
					:class="form.ruleset === id ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-surface-2 hover:border-muted'"
				>
					<input
						v-model="form.ruleset"
						type="radio"
						name="ruleset"
						:value="id"
						class="sr-only"
					>
					<span class="block font-semibold text-ink">
						{{ $t(`rules.${id}.name`) }}
					</span>
					<span class="block text-xs leading-snug text-muted">
						{{ $t(`rules.${id}.description`) }}
					</span>
				</label>
			</div>
		</fieldset>
		<label class="field">
			<span>{{ $t("designs.lobbyDesign") }}</span>
			<select v-model="form.presetId" class="input">
				<DesignsPresetOptions />
			</select>
		</label>
		<div class="grid grid-cols-2 gap-3">
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
		<label class="field">
			<span>{{ $t("fields.turnTimeout") }}</span>
			<select v-model.number="form.turnTimeout" class="input">
				<option v-for="n in TURN_TIMEOUTS" :key="n" :value="n">
					{{ n ? $t("timeoutOption.seconds", { n }) : $t("timeoutOption.off") }}
				</option>
			</select>
		</label>
		<p v-if="error" class="my-2 text-danger">{{ error }}</p>
		<button
			type="submit"
			class="btn btn-primary w-full px-6 py-3 text-[1.05rem]"
			:disabled="busy"
		>
			{{ $t("home.create") }}
		</button>
	</form>
</template>
