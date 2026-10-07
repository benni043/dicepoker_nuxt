<script setup lang="ts">
	import {
		CATEGORIES,
		CATEGORY_SHORT,
		type Category,
		columnTotal,
		type ScoreColumn,
		scoreFor,
		sheetTotal,
	} from "#shared/game";
	import type { LastAction } from "#shared/types";

	const props = defineProps<{
		players: { id: string; name: string }[];
		columns: number;
		scores: Record<string, ScoreColumn[]>;
		currentPlayerId: string | null;
		meId: string;
		/** The local player may enter a score now. */
		pickable: boolean;
		dice: number[];
		served: boolean;
		lastAction: LastAction | null;
	}>();

	const emit = defineEmits<{
		pick: [column: number, category: Category, points: number];
	}>();

	const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

	const sheet = (playerId: string) => props.scores[playerId] ?? [];
	const cell = (playerId: string, column: number, category: Category) =>
		sheet(playerId)[column]?.[category];
	const preview = (playerId: string, column: number, category: Category) =>
		scoreFor(category, props.dice, props.served, sheet(playerId)[column] ?? {});

	function isLast(playerId: string, column: number, category: Category) {
		const a = props.lastAction;
		return (
			!!a &&
			a.playerId === playerId &&
			a.column === column &&
			a.category === category
		);
	}
</script>

<template>
	<div class="sheet-scroll">
		<table class="score-table">
			<thead>
				<tr>
					<th class="cat" rowspan="2" />
					<th
						v-for="p in players"
						:key="p.id"
						:colspan="columns"
						class="player-head"
						:class="{ current: p.id === currentPlayerId, me: p.id === meId }"
					>
						{{ p.name }}
					</th>
				</tr>
				<tr>
					<template v-for="p in players" :key="p.id">
						<th
							v-for="c in columns"
							:key="c"
							class="col-head"
							:class="{ current: p.id === currentPlayerId, start: c === 1 }"
						>
							{{ ROMAN[c - 1] }}
						</th>
					</template>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="cat in CATEGORIES"
					:key="cat"
					:class="{ divider: cat === 'fullHouse' }"
				>
					<th class="cat" :title="$t(`categories.${cat}`)">
						{{ CATEGORY_SHORT[cat] }}
					</th>
					<template v-for="p in players" :key="p.id">
						<td
							v-for="c in columns"
							:key="c"
							:class="{ current: p.id === currentPlayerId, start: c === 1, last: isLast(p.id, c - 1, cat) }"
						>
							<span
								v-if="cell(p.id, c - 1, cat) !== undefined"
								:class="{ struck: cell(p.id, c - 1, cat) === 0 }"
							>
								{{
									cell(p.id, c - 1, cat) === 0 ? "–" : cell(p.id, c - 1, cat)
								}}
							</span>
							<button
								type="button"
								v-else-if="pickable && p.id === meId"
								class="pick"
								:class="{ zero: preview(p.id, c - 1, cat) === 0 }"
								:title="$t('sheet.cellTitle', { field: $t(`categories.${cat}`), column: ROMAN[c - 1] })"
								@click="emit('pick', c - 1, cat, preview(p.id, c - 1, cat))"
							>
								{{ preview(p.id, c - 1, cat) }}
							</button>
						</td>
					</template>
				</tr>
				<tr class="sum-row">
					<th class="cat">Σ</th>
					<template v-for="p in players" :key="p.id">
						<td
							v-for="c in columns"
							:key="c"
							:class="{ current: p.id === currentPlayerId, start: c === 1 }"
						>
							{{ columnTotal(sheet(p.id)[c - 1]) }}
						</td>
					</template>
				</tr>
				<tr class="total-row">
					<th class="cat">{{ $t("sheet.total") }}</th>
					<td
						v-for="p in players"
						:key="p.id"
						:colspan="columns"
						class="start"
						:class="{ current: p.id === currentPlayerId }"
					>
						{{ sheetTotal(sheet(p.id)) }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style scoped>
	.sheet-scroll {
		overflow-x: auto;
	}
	.score-table {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: center;
		padding: 0;
		height: 34px;
		min-width: 42px;
		border-bottom: 1px solid var(--border);
	}
	td.start,
	th.start {
		border-left: 1px solid var(--border);
	}
	.player-head {
		padding: 0.4rem 0.5rem;
		border-left: 1px solid var(--border);
		font-weight: 700;
		white-space: nowrap;
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.player-head.me {
		color: var(--accent);
	}
	.col-head {
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
	}
	.current {
		background: rgba(74, 222, 128, 0.06);
	}
	.player-head.current {
		background: rgba(74, 222, 128, 0.14);
	}
	.cat {
		text-align: left;
		padding: 0 0.6rem;
		color: var(--muted);
		font-weight: 700;
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 1;
		min-width: 56px;
	}
	tr.divider > * {
		border-top: 2px solid var(--surface-3);
	}
	.struck {
		color: var(--muted);
	}
	.last {
		animation: flash 1.6s ease-out;
	}
	@keyframes flash {
		from {
			background: rgba(251, 191, 36, 0.45);
		}
	}
	.pick {
		width: 100%;
		height: 100%;
		border: none;
		background: rgba(74, 222, 128, 0.12);
		color: var(--accent);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s;
	}
	.pick:hover {
		background: rgba(74, 222, 128, 0.3);
	}
	.pick.zero {
		background: transparent;
		color: rgba(139, 147, 167, 0.5);
		font-weight: 400;
	}
	.pick.zero:hover {
		background: rgba(248, 113, 113, 0.15);
		color: var(--danger);
	}
	.sum-row td {
		color: var(--muted);
		font-weight: 600;
	}
	.total-row td {
		font-weight: 800;
		font-size: 1.05rem;
		border-bottom: none;
	}
</style>
