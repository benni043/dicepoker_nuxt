<script setup lang="ts">
	const { presets, saved } = useDiceDesigns();
</script>

<template>
	<option value="">{{ $t("designs.none") }}</option>
	<optgroup v-if="presets.length" :label="$t('designs.myPresets')">
		<option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name }}</option>
	</optgroup>
	<optgroup v-if="saved.length" :label="$t('designs.savedPresets')">
		<option v-for="p in saved" :key="p.id" :value="p.id">
			{{ p.name }} ({{ p.owner }})
		</option>
	</optgroup>
</template>
