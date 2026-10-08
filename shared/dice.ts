import type { Pose, Quat } from "./types";

export const DIE_SIZE = 0.5;
export const ARENA_HALF = 2.5;
export const WALL_HEIGHT = 0.7;
export const TRAY_Z = ARENA_HALF + 0.75;

export const FACE_NORMALS: { dir: [number, number, number]; value: number }[] =
	[
		{ dir: [0, 1, 0], value: 1 },
		{ dir: [0, -1, 0], value: 6 },
		{ dir: [1, 0, 0], value: 3 },
		{ dir: [-1, 0, 0], value: 4 },
		{ dir: [0, 0, 1], value: 2 },
		{ dir: [0, 0, -1], value: 5 },
	];

const S = Math.SQRT1_2;
const FACE_UP: Record<number, Quat> = {
	1: [0, 0, 0, 1],
	6: [1, 0, 0, 0],
	3: [0, 0, S, S],
	4: [0, 0, -S, S],
	2: [-S, 0, 0, S],
	5: [S, 0, 0, S],
};

function multiply(a: Quat, b: Quat): Quat {
	const [ax, ay, az, aw] = a;
	const [bx, by, bz, bw] = b;
	return [
		aw * bx + ax * bw + ay * bz - az * by,
		aw * by - ax * bz + ay * bw + az * bx,
		aw * bz + ax * by - ay * bx + az * bw,
		aw * bw - ax * bx - ay * by - az * bz,
	];
}

export function faceUpQuat(value: number, yaw = 0): Quat {
	const turn: Quat = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
	return multiply(turn, FACE_UP[value] ?? FACE_UP[1]!);
}

export function idlePose(index: number): Pose {
	return {
		p: [(index - 2) * 0.8, DIE_SIZE / 2, ARENA_HALF - 0.9],
		q: faceUpQuat((index % 6) + 1),
	};
}

export function trayPose(index: number, value: number): Pose {
	return { p: [(index - 2) * 0.8, DIE_SIZE / 2, TRAY_Z], q: faceUpQuat(value) };
}
