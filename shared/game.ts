export type Category =
	| "ones"
	| "twos"
	| "threes"
	| "fours"
	| "fives"
	| "sixes"
	| "threeOfKind"
	| "fourOfKind"
	| "fullHouse"
	| "street"
	| "smallStraight"
	| "largeStraight"
	| "poker"
	| "grande"
	| "doubleGrande"
	| "chance";

export const RULESET_IDS = ["poker", "kniffel"] as const;
export type RulesetId = (typeof RULESET_IDS)[number];

export interface Ruleset {
	id: RulesetId;
	categories: readonly Category[];
	firstSpecial: Category;
	hasServed: boolean;
	bonus: { threshold: number; points: number } | null;
	score: (
		category: Category,
		dice: number[],
		served: boolean,
		column: ScoreColumn,
	) => number;
}

export const DICE_COUNT = 5;
export const MAX_ROLLS = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MAX_COLUMNS = 6;

export type ScoreColumn = Partial<Record<Category, number>>;

const UPPER: readonly Category[] = [
	"ones",
	"twos",
	"threes",
	"fours",
	"fives",
	"sixes",
];

const FACE_OF: Partial<Record<Category, number>> = {
	ones: 1,
	twos: 2,
	threes: 3,
	fours: 4,
	fives: 5,
	sixes: 6,
};

export const POKER_POINTS = {
	fullHouse: { normal: 20, served: 25 },
	street: { normal: 30, served: 35 },
	poker: { normal: 40, served: 45 },
	grande: { normal: 50, served: 100 },
	doubleGrande: { normal: 0, served: 100 },
} as const;

export const KNIFFEL_POINTS = {
	fullHouse: 25,
	smallStraight: 30,
	largeStraight: 40,
	grande: 50,
} as const;

function groups(dice: number[]): number[] {
	const counts = [0, 0, 0, 0, 0, 0, 0];
	for (const d of dice) counts[d]!++;
	return counts.filter((c) => c > 0).sort((a, b) => b - a);
}

function hasRun(dice: number[], length: number): boolean {
	const unique = new Set(dice);
	for (let start = 1; start + length - 1 <= 6; start++) {
		let ok = true;
		for (let v = start; v < start + length; v++) ok &&= unique.has(v);
		if (ok) return true;
	}
	return false;
}

export const isUpper = (category: Category) => category in FACE_OF;

const sum = (dice: number[]) => dice.reduce((a, b) => a + b, 0);

function upperScore(category: Category, dice: number[]): number | null {
	const face = FACE_OF[category];
	return face ? dice.filter((d) => d === face).length * face : null;
}

const poker: Ruleset = {
	id: "poker",
	categories: [
		...UPPER,
		"fullHouse",
		"street",
		"poker",
		"grande",
		"doubleGrande",
	],
	firstSpecial: "fullHouse",
	hasServed: true,
	bonus: null,
	score(category, dice, served) {
		const upper = upperScore(category, dice);
		if (upper !== null) return upper;
		const g = groups(dice);
		const matched =
			category === "fullHouse"
				? g[0] === 5 || (g[0] === 3 && g[1] === 2)
				: category === "street"
					? hasRun(dice, 5)
					: category === "poker"
						? g[0]! >= 4
						: category === "grande" || category === "doubleGrande"
							? g[0] === 5
							: false;
		if (!matched || !(category in POKER_POINTS)) return 0;
		const points = POKER_POINTS[category as keyof typeof POKER_POINTS];
		return served ? points.served : points.normal;
	},
};

const kniffel: Ruleset = {
	id: "kniffel",
	categories: [
		...UPPER,
		"threeOfKind",
		"fourOfKind",
		"fullHouse",
		"smallStraight",
		"largeStraight",
		"grande",
		"chance",
	],
	firstSpecial: "threeOfKind",
	hasServed: false,
	bonus: { threshold: 60, points: 30 },
	score(category, dice) {
		const upper = upperScore(category, dice);
		if (upper !== null) return upper;
		const g = groups(dice);
		switch (category) {
			case "threeOfKind":
				return g[0]! >= 3 ? sum(dice) : 0;
			case "fourOfKind":
				return g[0]! >= 4 ? sum(dice) : 0;
			case "fullHouse":
				return g[0] === 3 && g[1] === 2 ? KNIFFEL_POINTS.fullHouse : 0;
			case "smallStraight":
				return hasRun(dice, 4) ? KNIFFEL_POINTS.smallStraight : 0;
			case "largeStraight":
				return hasRun(dice, 5) ? KNIFFEL_POINTS.largeStraight : 0;
			case "grande":
				return g[0] === 5 ? KNIFFEL_POINTS.grande : 0;
			case "chance":
				return sum(dice);
			default:
				return 0;
		}
	},
};

export const RULESETS: Record<RulesetId, Ruleset> = { poker, kniffel };

export function rulesetOf(id: unknown): Ruleset {
	return RULESETS[id as RulesetId] ?? poker;
}

export function upperSum(column: ScoreColumn | undefined): number {
	return UPPER.reduce((total, c) => total + (column?.[c] ?? 0), 0);
}

export function columnBonus(
	rules: Ruleset,
	column: ScoreColumn | undefined,
): number {
	return rules.bonus && upperSum(column) >= rules.bonus.threshold
		? rules.bonus.points
		: 0;
}

export function columnTotal(
	rules: Ruleset,
	column: ScoreColumn | undefined,
): number {
	if (!column) return 0;
	const fields = rules.categories.reduce(
		(total, c) => total + (column[c] ?? 0),
		0,
	);
	return fields + columnBonus(rules, column);
}

export function sheetTotal(
	rules: Ruleset,
	sheet: ScoreColumn[] | undefined,
): number {
	return (sheet ?? []).reduce((total, c) => total + columnTotal(rules, c), 0);
}

export function isSheetComplete(rules: Ruleset, sheet: ScoreColumn[]): boolean {
	return sheet.every((col) =>
		rules.categories.every((c) => col[c] !== undefined),
	);
}

export const TURN_TIMEOUTS = [0, 30, 45, 60] as const;

const maxPotential = new Map<string, number>();

/** Highest score a category can ever yield; used to strike cheap fields first. */
function potential(rules: Ruleset, category: Category): number {
	const key = `${rules.id}:${category}`;
	let best = maxPotential.get(key);
	if (best === undefined) {
		best = 0;
		for (let n = 0; n < 6 ** DICE_COUNT; n++) {
			const dice = Array.from(
				{ length: DICE_COUNT },
				(_, i) => (Math.floor(n / 6 ** i) % 6) + 1,
			);
			best = Math.max(best, rules.score(category, dice, true, {}));
		}
		maxPotential.set(key, best);
	}
	return best;
}

/** Picks the open field that scores the most; on ties (incl. striking) it uses the field with the lowest potential. */
export function bestMove(
	rules: Ruleset,
	sheet: ScoreColumn[],
	dice: number[],
	served: boolean,
): { column: number; category: Category } | null {
	let best: { column: number; category: Category } | null = null;
	let bestPoints = -1;
	let bestPotential = 0;
	sheet.forEach((column, index) => {
		for (const category of rules.categories) {
			if (column[category] !== undefined) continue;
			const points = rules.score(category, dice, served, column);
			const pot = potential(rules, category);
			if (
				points > bestPoints ||
				(points === bestPoints && pot < bestPotential)
			) {
				best = { column: index, category };
				bestPoints = points;
				bestPotential = pot;
			}
		}
	});
	return best;
}
