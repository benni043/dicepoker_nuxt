<script setup lang="ts">
	import type { LobbyDesign } from "#shared/types";

	defineProps<{ design: LobbyDesign | null; isHost: boolean }>();
	const emit = defineEmits<{ change: [presetId: string | null] }>();

	const { presets, settings } = useDiceDesigns();

	function onChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		if (select.value === "keep") return;
		emit("change", select.value || null);
		select.value = "keep";
	}
</script>

<template>
	<div
		class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm"
	>
		<DesignsPresetPreview :layout="design?.layout ?? null" />
		<span class="text-muted">{{ $t("designs.lobbyDesign") }}:</span>
		<strong>{{ design?.name ?? $t("designs.none") }}</strong>
		<select
			v-if="isHost"
			class="input ml-auto w-auto px-2 py-1 text-sm"
			value="keep"
			:aria-label="$t('designs.lobbyDesign')"
			@change="onChange"
		>
			<option value="keep" disabled>{{ $t("designs.change") }}</option>
			<option value="">{{ $t("designs.none") }}</option>
			<option v-for="p in presets" :key="p.id" :value="p.id">
				{{ p.name }}
			</option>
		</select>
		<span v-if="settings.alwaysOwn" class="w-full text-xs text-muted">
			{{ $t("designs.usingOwn") }}
		</span>
	</div>
</template>
