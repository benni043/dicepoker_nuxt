<script setup lang="ts">
	import type { PublicDicePreset } from "#shared/types";

	const { t } = useI18n();
	const { saved, searchPublic, savePreset, unsavePreset } = useDiceDesigns();

	const query = ref("");
	const results = ref<PublicDicePreset[]>([]);
	const searched = ref(false);
	const error = ref("");
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function search() {
		results.value = await searchPublic(query.value.trim());
		searched.value = true;
	}

	watch(query, () => {
		clearTimeout(timer);
		timer = setTimeout(search, 300);
	});

	onMounted(search);

	const isSaved = (id: string) => saved.value.some((p) => p.id === id);

	async function toggle(preset: PublicDicePreset) {
		error.value = "";
		try {
			if (isSaved(preset.id)) await unsavePreset(preset.id);
			else await savePreset(preset);
		} catch (e) {
			const code = (e as { statusMessage?: string }).statusMessage;
			error.value =
				code === "TOO_MANY_SAVED"
					? t("designs.tooManySaved")
					: t("errors.INTERNAL");
		}
	}
</script>

<template>
	<div>
		<input
			v-model="query"
			class="input mb-3"
			type="search"
			:placeholder="$t('designs.searchPlaceholder')"
		>
		<p v-if="error" class="mb-2 text-sm text-danger">{{ error }}</p>
		<ul v-if="results.length">
			<li
				v-for="preset in results"
				:key="preset.id"
				class="flex flex-wrap items-center gap-3 border-b border-line py-2.5 last:border-b-0"
			>
				<DesignsPresetPreview :layout="preset.layout" />
				<div class="min-w-0 flex-1">
					<div class="truncate font-semibold">{{ preset.name }}</div>
					<div class="text-xs text-muted">
						{{ $t("designs.by", { name: preset.owner }) }}
					</div>
				</div>
				<button
					type="button"
					class="btn px-3 py-1.5 text-sm"
					:class="{ 'btn-primary': isSaved(preset.id) }"
					@click="toggle(preset)"
				>
					{{ isSaved(preset.id) ? $t("designs.saved") : $t("designs.save") }}
				</button>
			</li>
		</ul>
		<p v-else-if="searched" class="text-sm text-muted">
			{{ $t("designs.noResults") }}
		</p>
	</div>
</template>
