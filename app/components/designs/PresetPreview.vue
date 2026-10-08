<script setup lang="ts">
	import type { DiceLayout } from "#shared/types";
	import { diceImageUrl } from "~/composables/useDiceDesigns";

	const props = defineProps<{ layout: DiceLayout | null }>();

	const faceImage = (face: number) => {
		const id = props.layout?.find((die) => die[face])?.[face];
		return id ? diceImageUrl(id) : null;
	};
</script>

<template>
	<div class="flex gap-1">
		<span
			v-for="face in 6"
			:key="face"
			class="size-6 shrink-0 overflow-hidden rounded bg-die"
		>
			<DieFace :value="face" :image="faceImage(face - 1)" />
		</span>
	</div>
</template>
