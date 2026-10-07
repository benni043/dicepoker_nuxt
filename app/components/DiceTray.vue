<script setup lang="ts">
	defineProps<{
		values: number[];
		held: boolean[];
		/** false before the first roll of a turn or while dice are rolling */
		revealed: boolean;
		clickable: boolean;
	}>();

	const emit = defineEmits<{ toggle: [index: number] }>();

	// Pip cells in a 3x3 grid, numbered 0-8 row by row.
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
	<div class="tray">
		<div v-for="(value, i) in values" :key="i" class="slot">
			<button
				type="button"
				class="die"
				:class="{ held: held[i], hidden: !revealed, clickable }"
				:disabled="!clickable"
				:aria-pressed="held[i]"
				:aria-label="revealed ? $t('tray.dieValue', { n: i + 1, value }) : $t('tray.die', { n: i + 1 })"
				@click="emit('toggle', i)"
			>
				<span
					v-for="cell in 9"
					:key="cell"
					class="pip"
					:class="{ on: revealed && PIPS[value]?.includes(cell - 1), red: value === 1 }"
				/>
			</button>
			<span class="hold-label" :class="{ visible: held[i] }">{{
				$t("tray.held")
			}}</span>
		</div>
	</div>
</template>

<style scoped>
	.tray {
		display: flex;
		gap: 0.6rem;
		justify-content: center;
	}
	.slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}
	.die {
		width: clamp(42px, 12vw, 52px);
		height: clamp(42px, 12vw, 52px);
		border-radius: 10px;
		background: #f4f1ea;
		border: 2px solid transparent;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		padding: 7px;
		gap: 2px;
		transition:
			transform 0.15s,
			border-color 0.15s,
			box-shadow 0.15s,
			opacity 0.15s;
		box-shadow: 0 3px 0 #b9b2a3;
	}
	.die.clickable {
		cursor: pointer;
	}
	.die.clickable:hover {
		transform: translateY(-2px);
	}
	.die.hidden {
		opacity: 0.25;
	}
	.die.held {
		border-color: var(--gold);
		box-shadow:
			0 0 0 3px rgba(251, 191, 36, 0.3),
			0 3px 0 #b9b2a3;
		transform: translateY(-3px);
	}
	.pip {
		border-radius: 50%;
		margin: 1px;
	}
	.pip.on {
		background: #1a1c22;
	}
	.pip.on.red {
		background: #c0262d;
	}
	.hold-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--gold);
		visibility: hidden;
	}
	.hold-label.visible {
		visibility: visible;
	}
</style>
