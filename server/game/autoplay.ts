import { randomInt } from "node:crypto";
import {
	bestMove,
	DICE_COUNT,
	MAX_ROLLS,
	type Ruleset,
	type ScoreColumn,
} from "#shared/game";
import type { DieState } from "#shared/types";

/**
 * Dice are handled as face counts encoded in base 6 (count of ones * 1 + count of twos * 6 + …),
 * so "kept dice + rerolled dice" is a plain addition of two codes.
 */
const POW = [1, 6, 36, 216, 1296, 7776];
const CODE_SPACE = 6 ** 6;

function codeOf(values: number[]): number {
	return values.reduce((code, v) => code + POW[v - 1]!, 0);
}

function diceOf(code: number): number[] {
	const dice: number[] = [];
	for (let face = 0; face < 6; face++) {
		const count = Math.floor(code / POW[face]!) % 6;
		for (let i = 0; i < count; i++) dice.push(face + 1);
	}
	return dice;
}

const outcomeCache = new Map<number, { code: number; p: number }[]>();

/** Every distinct result of rolling `n` dice, with its probability. */
function outcomes(n: number) {
	let list = outcomeCache.get(n);
	if (!list) {
		const counts = new Map<number, number>();
		for (let seq = 0; seq < 6 ** n; seq++) {
			let code = 0;
			for (let i = 0; i < n; i++) code += POW[Math.floor(seq / 6 ** i) % 6]!;
			counts.set(code, (counts.get(code) ?? 0) + 1);
		}
		list = [...counts].map(([code, c]) => ({ code, p: c / 6 ** n }));
		outcomeCache.set(n, list);
	}
	return list;
}

/** All distinct ways to keep some of the dice (as codes), including keeping none. */
function keepOptions(code: number): number[] {
	let options = [0];
	for (let face = 0; face < 6; face++) {
		const count = Math.floor(code / POW[face]!) % 6;
		const next: number[] = [];
		for (const base of options)
			for (let k = 0; k <= count; k++) next.push(base + k * POW[face]!);
		options = next;
	}
	return options;
}

function diceCount(code: number) {
	let n = 0;
	for (let face = 0; face < 6; face++) n += Math.floor(code / POW[face]!) % 6;
	return n;
}

/** Plans holds that maximise the expected points of the best free field at the end of the turn. */
function createPlanner(rules: Ruleset, sheet: ScoreColumn[]) {
	const memo = new Map<number, Float64Array>();

	function stopValue(code: number, roll: number) {
		const dice = diceOf(code);
		const served = rules.hasServed && roll === 1;
		const move = bestMove(rules, sheet, dice, served);
		return move
			? rules.score(move.category, dice, served, sheet[move.column]!)
			: 0;
	}

	function rerollValue(keep: number, roll: number) {
		let expected = 0;
		for (const o of outcomes(DICE_COUNT - diceCount(keep)))
			expected += o.p * value(keep + o.code, roll + 1);
		return expected;
	}

	function value(code: number, roll: number): number {
		let table = memo.get(roll);
		if (!table) {
			table = new Float64Array(CODE_SPACE).fill(Number.NaN);
			memo.set(roll, table);
		}
		const cached = table[code]!;
		if (!Number.isNaN(cached)) return cached;
		let best = stopValue(code, roll);
		if (roll < MAX_ROLLS)
			for (const keep of keepOptions(code))
				if (keep !== code) best = Math.max(best, rerollValue(keep, roll));
		table[code] = best;
		return best;
	}

	/** Dice to keep before the next roll, or null to stop and score now. */
	function choose(values: number[], roll: number): number | null {
		const code = codeOf(values);
		if (roll >= MAX_ROLLS) return null;
		let best = stopValue(code, roll);
		let choice: number | null = null;
		for (const keep of keepOptions(code)) {
			if (keep === code) continue;
			const expected = rerollValue(keep, roll);
			if (expected > best + 1e-9) {
				best = expected;
				choice = keep;
			}
		}
		return choice;
	}

	return { choose };
}

/**
 * Plays the rest of a turn instantly: rolls (up to the roll limit), holding dice the way that
 * gives the best expected score. The caller then writes the best field.
 */
export function autoRollTurn(
	rules: Ruleset,
	sheet: ScoreColumn[],
	dice: DieState[],
	rollCount: number,
): { dice: DieState[]; rollCount: number } {
	const planner = createPlanner(rules, sheet);
	let values = dice.map((d) => d.value);
	let rolls = rollCount;
	let held = Array<boolean>(DICE_COUNT).fill(false);

	const roll = () => {
		values = values.map((v, i) => (held[i] ? v : randomInt(1, 7)));
		rolls++;
	};

	if (rolls === 0) roll();
	for (;;) {
		const keep = planner.choose(values, rolls);
		if (keep === null) break;
		const wanted = diceOf(keep);
		held = values.map((v) => {
			const at = wanted.indexOf(v);
			if (at < 0) return false;
			wanted.splice(at, 1);
			return true;
		});
		roll();
	}
	return {
		dice: values.map((value, i) => ({ value, held: held[i]!, pose: null })),
		rollCount: rolls,
	};
}
