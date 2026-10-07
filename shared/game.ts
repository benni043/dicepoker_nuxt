// Rules shared by server (authoritative scoring) and client (score previews).

export const CATEGORIES = [
	"ones",
	"twos",
	"threes",
	"fours",
	"fives",
	"sixes",
	"fullHouse",
	"street",
	"poker",
	"grande",
	"doubleGrande",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Abbreviations in the score sheet; full names live in i18n (`categories.*`). */
export const CATEGORY_SHORT: Record<Category, string> = {
	ones: "1",
	twos: "2",
	threes: "3",
	fours: "4",
	fives: "5",
	sixes: "6",
	fullHouse: "F",
	street: "St",
	poker: "P",
	grande: "G",
	doubleGrande: "DG",
};

/** Points for the combination fields. "served" = thrown with the first roll of a turn. */
export const COMBO_POINTS = {
	fullHouse: { normal: 30, served: 35 },
	street: { normal: 20, served: 25 },
	poker: { normal: 40, served: 45 },
	grande: { normal: 50, served: 80 },
	doubleGrande: { normal: 100, served: 120 },
} as const;

/** A Doppel-Grande only counts once the Grande field of the same column holds a Grande. */
export const DOUBLE_GRANDE_NEEDS_GRANDE = true;

export const DICE_COUNT = 5;
export const MAX_ROLLS = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MAX_COLUMNS = 6;

/** One column of a player's sheet; a missing key means the field is still open. */
export type ScoreColumn = Partial<Record<Category, number>>;

const FACE_OF: Partial<Record<Category, number>> = {
	ones: 1,
	twos: 2,
	threes: 3,
	fours: 4,
	fives: 5,
	sixes: 6,
};

export function isCombo(
	category: Category,
): category is keyof typeof COMBO_POINTS {
	return category in COMBO_POINTS;
}

export function matches(category: Category, dice: number[]): boolean {
	const counts = [0, 0, 0, 0, 0, 0, 0];
	for (const d of dice) counts[d]!++;
	const groups = counts.filter((c) => c > 0).sort((a, b) => b - a);
	switch (category) {
		case "fullHouse":
			return groups[0] === 5 || (groups[0] === 3 && groups[1] === 2);
		case "street": {
			const key = [...dice].sort().join("");
			return key === "12345" || key === "23456";
		}
		case "poker":
			return groups[0]! >= 4;
		case "grande":
		case "doubleGrande":
			return groups[0] === 5;
		default:
			return true;
	}
}

export function scoreFor(
	category: Category,
	dice: number[],
	served: boolean,
	column: ScoreColumn,
): number {
	const face = FACE_OF[category];
	if (face) return dice.filter((d) => d === face).length * face;
	if (!isCombo(category) || !matches(category, dice)) return 0;
	if (
		category === "doubleGrande" &&
		DOUBLE_GRANDE_NEEDS_GRANDE &&
		!column.grande
	)
		return 0;
	const points = COMBO_POINTS[category];
	return served ? points.served : points.normal;
}

export function columnTotal(column: ScoreColumn | undefined): number {
	if (!column) return 0;
	return CATEGORIES.reduce((sum, c) => sum + (column[c] ?? 0), 0);
}

export function sheetTotal(sheet: ScoreColumn[] | undefined): number {
	return (sheet ?? []).reduce((sum, c) => sum + columnTotal(c), 0);
}

export function isSheetComplete(sheet: ScoreColumn[]): boolean {
	return sheet.every((col) => CATEGORIES.every((c) => col[c] !== undefined));
}
