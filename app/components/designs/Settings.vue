<script setup lang="ts">
	import type { DicePreset } from "#shared/types";

	const { t } = useI18n();
	const {
		presets,
		saved,
		settings,
		load,
		unsavePreset,
		createPreset,
		updatePreset,
		deletePreset,
		updateSettings,
	} = useDiceDesigns();

	const editingId = ref<string | null>(null);
	const newName = ref("");
	const error = ref("");

	const editing = computed(
		() => presets.value.find((p) => p.id === editingId.value) ?? null,
	);

	onMounted(async () => {
		await load();
		editingId.value =
			settings.value.defaultPresetId ?? presets.value[0]?.id ?? null;
	});

	async function create() {
		error.value = "";
		try {
			const preset = await createPreset(newName.value.trim());
			newName.value = "";
			editingId.value = preset.id;
			if (!settings.value.defaultPresetId)
				await updateSettings({ defaultPresetId: preset.id });
		} catch (e) {
			const code = (e as { statusMessage?: string }).statusMessage;
			error.value =
				code === "TOO_MANY_PRESETS"
					? t("designs.tooManyPresets")
					: t("errors.INTERNAL");
		}
	}

	function rename(preset: DicePreset, event: Event) {
		const name = (event.target as HTMLInputElement).value.trim();
		if (name && name !== preset.name) updatePreset(preset.id, { name });
	}

	async function remove(preset: DicePreset) {
		if (!confirm(t("designs.deletePresetConfirm", { name: preset.name })))
			return;
		await deletePreset(preset.id);
		if (editingId.value === preset.id)
			editingId.value = presets.value[0]?.id ?? null;
	}

	function onDefaultChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		updateSettings({ defaultPresetId: value || null });
	}
</script>

<template>
	<section class="card">
		<h2>{{ $t("designs.title") }}</h2>

		<div class="mb-5 grid gap-4 sm:grid-cols-2">
			<label class="field mb-0">
				<span>{{ $t("designs.myDesign") }}</span>
				<select
					class="input"
					:value="settings.defaultPresetId ?? ''"
					@change="onDefaultChange"
				>
					<DesignsPresetOptions />
				</select>
			</label>
			<div class="flex items-start gap-3">
				<button
					type="button"
					role="switch"
					:aria-checked="settings.alwaysOwn"
					class="relative mt-1 h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
					:class="settings.alwaysOwn ? 'bg-accent' : 'bg-surface-3'"
					@click="updateSettings({ alwaysOwn: !settings.alwaysOwn })"
				>
					<span
						class="absolute top-0.5 left-0.5 size-5 rounded-full bg-ink transition-transform"
						:class="{ 'translate-x-5': settings.alwaysOwn }"
					/>
				</button>
				<div>
					<div class="text-sm font-semibold">
						{{ $t("designs.alwaysOwn") }}
					</div>
					<div class="text-xs text-muted">
						{{ $t("designs.alwaysOwnHint") }}
					</div>
				</div>
			</div>
		</div>

		<h3 class="mb-2 text-[0.95rem] text-muted">
			{{ $t("designs.myPresets") }}
		</h3>
		<ul class="mb-4">
			<li
				v-for="p in presets"
				:key="p.id"
				class="flex flex-wrap items-center gap-2.5 border-b border-line py-2.5"
			>
				<DesignsPresetPreview :layout="p.layout" />
				<input
					:value="p.name"
					class="input min-w-32 flex-1 px-2 py-1.5 text-sm"
					maxlength="40"
					:aria-label="$t('designs.presetName')"
					@change="rename(p, $event)"
				>
				<button
					type="button"
					class="badge cursor-pointer"
					:class="p.isPublic ? 'badge-green' : 'badge-muted'"
					:title="$t('designs.visibilityHint')"
					@click="updatePreset(p.id, { isPublic: !p.isPublic })"
				>
					{{ p.isPublic ? $t("designs.public") : $t("designs.private") }}
				</button>
				<button
					type="button"
					class="btn px-3 py-1.5 text-sm"
					:class="{ 'btn-primary': p.id === editingId }"
					@click="editingId = p.id"
				>
					{{ $t("designs.edit") }}
				</button>
				<button
					type="button"
					class="link text-sm text-danger"
					@click="remove(p)"
				>
					{{ $t("designs.delete") }}
				</button>
			</li>
		</ul>
		<form class="flex gap-2" @submit.prevent="create">
			<input
				v-model="newName"
				class="input flex-1"
				maxlength="40"
				required
				:placeholder="$t('designs.newPresetName')"
			>
			<button
				type="submit"
				class="btn btn-primary whitespace-nowrap"
				:disabled="!newName.trim()"
			>
				{{ $t("designs.newPreset") }}
			</button>
		</form>
		<p v-if="error" class="mt-2 text-sm text-danger">{{ error }}</p>

		<template v-if="saved.length">
			<h3 class="mt-6 mb-2 text-[0.95rem] text-muted">
				{{ $t("designs.savedPresets") }}
			</h3>
			<ul>
				<li
					v-for="p in saved"
					:key="p.id"
					class="flex flex-wrap items-center gap-2.5 border-b border-line py-2.5 last:border-b-0"
				>
					<DesignsPresetPreview :layout="p.layout" />
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-semibold">{{ p.name }}</div>
						<div class="text-xs text-muted">
							{{ $t("designs.by", { name: p.owner }) }}
						</div>
					</div>
					<button
						type="button"
						class="link text-sm text-danger"
						@click="unsavePreset(p.id)"
					>
						{{ $t("designs.remove") }}
					</button>
				</li>
			</ul>
		</template>
	</section>

	<section v-if="editing" class="card">
		<h2>{{ $t("designs.editing", { name: editing.name }) }}</h2>
		<DesignsPresetEditor :preset="editing" />
	</section>

	<section class="card">
		<h2>{{ $t("designs.publicTitle") }}</h2>
		<DesignsPresetSearch />
	</section>
</template>
