<script setup lang="ts">
	defineProps<{
		values: number[];
		held: boolean[];
		revealed: boolean;
		clickable: boolean;
	}>();

	const emit = defineEmits<{ toggle: [index: number] }>();

	const PIPS: Record<number, number[]> = {
		1: [4],
		2: [0, 8],
		3: [0, 4, 8],
		4: [0, 2, 6, 8],
		5: [0, 2, 4, 6, 8],
		6: [0, 2, 3, 5, 6, 8],
	};

	function pipClass(value: number, cell: number, revealed: boolean) {
		if (!revealed || !PIPS[value]?.includes(cell - 1)) return "";
		return value === 1 ? "bg-pip-red" : "bg-pip";
	}
</script>

<template>
	<div class="flex justify-center gap-2.5">
		<div
			v-for="(value, i) in values"
			:key="i"
			class="flex flex-col items-center gap-1"
		>
			<button
				type="button"
				class="grid size-[clamp(42px,12vw,52px)] grid-cols-3 grid-rows-3 gap-0.5 rounded-[10px] border-2 bg-die p-[7px] transition"
				:class="[
					held[i]
						? '-translate-y-[3px] border-gold shadow-[0_0_0_3px_rgb(251_191_36/0.3),0_3px_0_var(--color-die-edge)]'
						: 'border-transparent shadow-[0_3px_0_var(--color-die-edge)]',
					revealed ? '' : 'opacity-25',
					clickable ? 'cursor-pointer hover:-translate-y-0.5' : '',
				]"
				:disabled="!clickable"
				:aria-pressed="held[i]"
				:aria-label="revealed ? $t('tray.dieValue', { n: i + 1, value }) : $t('tray.die', { n: i + 1 })"
				@click="emit('toggle', i)"
			>
				<span
					v-for="cell in 9"
					:key="cell"
					class="m-px rounded-full"
					:class="pipClass(value, cell, revealed)"
				/>
			</button>
			<span
				class="text-[0.7rem] font-bold tracking-wider text-gold uppercase"
				:class="held[i] ? 'visible' : 'invisible'"
			>
				{{ $t("tray.held") }}
			</span>
		</div>
	</div>
</template>
