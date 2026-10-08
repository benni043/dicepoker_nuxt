<script setup lang="ts">
	import {
		type Category,
		columnBonus,
		columnTotal,
		type RulesetId,
		rulesetOf,
		type ScoreColumn,
		sheetTotal,
		upperSum,
	} from "#shared/game";
	import type { LastAction } from "#shared/types";

	const props = defineProps<{
		players: { id: string; name: string }[];
		ruleset: RulesetId;
		columns: number;
		scores: Record<string, ScoreColumn[]>;
		currentPlayerId: string | null;
		meId: string;
		pickable: boolean;
		dice: number[];
		served: boolean;
		lastAction: LastAction | null;
	}>();

	const emit = defineEmits<{
		pick: [column: number, category: Category, points: number];
	}>();

	const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

	const rules = computed(() => rulesetOf(props.ruleset));

	const sheet = (playerId: string) => props.scores[playerId] ?? [];
	const cell = (playerId: string, column: number, category: Category) =>
		sheet(playerId)[column]?.[category];
	const preview = (playerId: string, column: number, category: Category) =>
		rules.value.score(
			category,
			props.dice,
			props.served,
			sheet(playerId)[column] ?? {},
		);

	function isLast(playerId: string, column: number, category: Category) {
		const a = props.lastAction;
		return (
			!!a &&
			a.playerId === playerId &&
			a.column === column &&
			a.category === category
		);
	}

	const cellBase = "h-[34px] min-w-[42px] border-b border-line p-0 text-center";
	const categoryCell =
		"sticky left-0 z-1 min-w-14 border-b border-line bg-surface px-2.5 text-left font-bold text-muted";

	function columnClass(playerId: string, column: number) {
		return [
			cellBase,
			column === 1 ? "border-l" : "",
			playerId === props.currentPlayerId ? "bg-accent/6" : "",
		];
	}
</script>

<template>
	<div class="overflow-x-auto">
		<table class="w-full border-separate border-spacing-0 text-sm tabular-nums">
			<thead>
				<tr>
					<th :class="categoryCell" rowspan="2" />
					<th
						v-for="p in players"
						:key="p.id"
						:colspan="columns"
						class="max-w-40 truncate border-b border-l border-line px-2 py-1.5 font-bold whitespace-nowrap"
						:class="[
							p.id === currentPlayerId ? 'bg-accent/14' : '',
							p.id === meId ? 'text-accent' : '',
						]"
					>
						{{ p.name }}
					</th>
				</tr>
				<tr>
					<template v-for="p in players" :key="p.id">
						<th
							v-for="c in columns"
							:key="c"
							:class="columnClass(p.id, c)"
							class="text-xs font-semibold text-muted"
						>
							{{ ROMAN[c - 1] }}
						</th>
					</template>
				</tr>
			</thead>
			<tbody>
				<template v-for="cat in rules.categories" :key="cat">
					<tr
						:class="cat === rules.firstSpecial ? '*:border-t-2 *:border-t-surface-3' : ''"
					>
						<th :class="categoryCell" :title="$t(`categories.${cat}`)">
							{{ $t(`categoryShort.${cat}`) }}
						</th>
						<template v-for="p in players" :key="p.id">
							<td
								v-for="c in columns"
								:key="c"
								:class="[columnClass(p.id, c), isLast(p.id, c - 1, cat) ? 'animate-flash' : '']"
							>
								<span
									v-if="cell(p.id, c - 1, cat) !== undefined"
									:class="cell(p.id, c - 1, cat) === 0 ? 'text-muted' : ''"
								>
									{{
										cell(p.id, c - 1, cat) === 0 ? "–" : cell(p.id, c - 1, cat)
									}}
								</span>
								<button
									v-else-if="pickable && p.id === meId"
									type="button"
									class="size-full cursor-pointer transition-colors"
									:class="
									preview(p.id, c - 1, cat) === 0
										? 'text-muted/50 hover:bg-danger/15 hover:text-danger'
										: 'bg-accent/12 font-bold text-accent hover:bg-accent/30'
								"
									:title="$t('sheet.cellTitle', { field: $t(`categories.${cat}`), column: ROMAN[c - 1] })"
									@click="emit('pick', c - 1, cat, preview(p.id, c - 1, cat))"
								>
									{{ preview(p.id, c - 1, cat) }}
								</button>
							</td>
						</template>
					</tr>
					<tr v-if="cat === 'sixes' && rules.bonus">
						<th
							:class="categoryCell"
							:title="$t('sheet.bonusTitle', { threshold: rules.bonus.threshold, points: rules.bonus.points })"
						>
							{{ $t("sheet.bonus") }}
						</th>
						<template v-for="p in players" :key="p.id">
							<td
								v-for="c in columns"
								:key="c"
								:class="columnClass(p.id, c)"
								class="text-xs"
							>
								<span
									v-if="columnBonus(rules, sheet(p.id)[c - 1])"
									class="font-bold text-gold"
								>
									+{{ columnBonus(rules, sheet(p.id)[c - 1]) }}
								</span>
								<span v-else class="text-muted">
									{{ upperSum(sheet(p.id)[c - 1]) }}/{{ rules.bonus.threshold }}
								</span>
							</td>
						</template>
					</tr>
				</template>
				<tr>
					<th :class="categoryCell">Σ</th>
					<template v-for="p in players" :key="p.id">
						<td
							v-for="c in columns"
							:key="c"
							:class="columnClass(p.id, c)"
							class="font-semibold text-muted"
						>
							{{ columnTotal(rules, sheet(p.id)[c - 1]) }}
						</td>
					</template>
				</tr>
				<tr>
					<th :class="categoryCell" class="border-b-0">
						{{ $t("sheet.total") }}
					</th>
					<td
						v-for="p in players"
						:key="p.id"
						:colspan="columns"
						:class="columnClass(p.id, 1)"
						class="border-b-0 text-[1.05rem] font-extrabold"
					>
						{{ sheetTotal(rules, sheet(p.id)) }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
