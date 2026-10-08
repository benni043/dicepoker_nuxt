<script setup lang="ts">
	withDefaults(
		defineProps<{
			value: number;
			image?: string | null;
			visible?: boolean;
		}>(),
		{ image: null, visible: true },
	);

	const PIPS: Record<number, number[]> = {
		1: [4],
		2: [0, 8],
		3: [0, 4, 8],
		4: [0, 2, 6, 8],
		5: [0, 2, 4, 6, 8],
		6: [0, 2, 3, 5, 6, 8],
	};
</script>

<template>
	<img
		v-if="image && visible"
		:src="image"
		alt=""
		class="size-full rounded-[inherit] object-cover"
		draggable="false"
	>
	<span v-else class="grid size-full grid-cols-3 grid-rows-3 gap-0.5 p-[14%]">
		<span
			v-for="cell in 9"
			:key="cell"
			class="m-px rounded-full"
			:class="
				visible && PIPS[value]?.includes(cell - 1)
					? value === 1
						? 'bg-pip-red'
						: 'bg-pip'
					: ''
			"
		/>
	</span>
</template>
