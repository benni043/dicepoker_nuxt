<script setup lang="ts">
	import type { DiceLayout } from "#shared/types";
	import { diceImageUrl } from "~/composables/useDiceDesigns";

	const props = defineProps<{
		values: number[];
		held: boolean[];
		revealed: boolean;
		clickable: boolean;
		skin?: DiceLayout | null;
	}>();

	const emit = defineEmits<{ toggle: [index: number] }>();

	function faceImage(die: number, value: number) {
		const id = props.skin?.[die]?.[value - 1];
		return id ? diceImageUrl(id) : null;
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
				class="size-[clamp(2.625rem,12vw,3.25rem)] overflow-hidden rounded-[10px] bg-die transition"
				:class="[
					held[i]
						? '-translate-y-[3px] shadow-[0_0_0_2px_var(--color-gold),0_0_0_5px_rgb(251_191_36/0.3),0_3px_0_var(--color-die-edge)]'
						: 'shadow-[0_3px_0_var(--color-die-edge)]',
					revealed ? '' : 'opacity-25',
					clickable ? 'cursor-pointer hover:-translate-y-0.5' : '',
				]"
				:disabled="!clickable"
				:aria-pressed="held[i]"
				:aria-label="revealed ? $t('tray.dieValue', { n: i + 1, value }) : $t('tray.die', { n: i + 1 })"
				@click="emit('toggle', i)"
			>
				<DieFace
					:value="value"
					:image="faceImage(i, value)"
					:visible="revealed"
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
