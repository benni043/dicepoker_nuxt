import * as CANNON from "cannon-es";
import { ARENA_HALF, DIE_SIZE, FACE_NORMALS } from "#shared/dice";
import type { DieState, Pose } from "#shared/types";

const STEP = 1 / 60;
const FPS = 30;
const MAX_STEPS = 60 * 8;
const CEILING = 2.2;
const MAX_ATTEMPTS = 12;
const HALF = DIE_SIZE / 2;

export interface SimulatedRoll {
	indices: number[];
	frames: number[][];
	fps: number;
	values: number[];
	poses: Pose[];
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function readFace(body: CANNON.Body) {
	const up = new CANNON.Vec3(0, 1, 0);
	const axis = new CANNON.Vec3();
	let best = { value: 1, dot: -Infinity };
	for (const { dir, value } of FACE_NORMALS) {
		body.quaternion.vmult(new CANNON.Vec3(...dir), axis);
		const dot = axis.dot(up);
		if (dot > best.dot) best = { value, dot };
	}
	return best;
}

function createWorld() {
	const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -30, 0) });
	world.allowSleep = true;
	(world.solver as CANNON.GSSolver).iterations = 15;

	const ground = new CANNON.Material("ground");
	const wall = new CANNON.Material("wall");
	const die = new CANNON.Material("die");
	world.addContactMaterial(
		new CANNON.ContactMaterial(ground, die, {
			friction: 0.35,
			restitution: 0.3,
		}),
	);
	world.addContactMaterial(
		new CANNON.ContactMaterial(wall, die, { friction: 0.1, restitution: 0.55 }),
	);
	world.addContactMaterial(
		new CANNON.ContactMaterial(die, die, { friction: 0.2, restitution: 0.4 }),
	);

	const addPlane = (
		material: CANNON.Material,
		pos: [number, number, number],
		euler: [number, number, number],
	) => {
		const body = new CANNON.Body({
			type: CANNON.Body.STATIC,
			shape: new CANNON.Plane(),
			material,
		});
		body.position.set(...pos);
		body.quaternion.setFromEuler(...euler);
		world.addBody(body);
	};
	addPlane(ground, [0, 0, 0], [-Math.PI / 2, 0, 0]);
	addPlane(wall, [0, CEILING, 0], [Math.PI / 2, 0, 0]);
	addPlane(wall, [0, 0, -ARENA_HALF], [0, 0, 0]);
	addPlane(wall, [0, 0, ARENA_HALF], [0, Math.PI, 0]);
	addPlane(wall, [-ARENA_HALF, 0, 0], [0, Math.PI / 2, 0]);
	addPlane(wall, [ARENA_HALF, 0, 0], [0, -Math.PI / 2, 0]);

	return { world, dieMaterial: die };
}

function runOnce(indices: number[]) {
	const { world, dieMaterial } = createWorld();
	const n = indices.length;

	const bodies = indices.map((_, k) => {
		const body = new CANNON.Body({
			mass: 1,
			shape: new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF)),
			material: dieMaterial,
			linearDamping: 0.1,
			angularDamping: 0.1,
			allowSleep: true,
			sleepSpeedLimit: 0.15,
			sleepTimeLimit: 0.25,
		});
		body.position.set(
			(k - (n - 1) / 2) * 0.65 + rand(-0.08, 0.08),
			rand(0.9, 1.3),
			ARENA_HALF - 0.7,
		);
		body.quaternion.setFromEuler(
			rand(0, Math.PI * 2),
			rand(0, Math.PI * 2),
			rand(0, Math.PI * 2),
		);
		body.velocity.set(rand(-1.5, 1.5), rand(2, 4.5), rand(-9, -5.5));
		body.angularVelocity.set(rand(-25, 25), rand(-25, 25), rand(-25, 25));
		world.addBody(body);
		return body;
	});

	const frames: number[][] = [];
	const record = () =>
		frames.push(
			bodies.flatMap((b) =>
				[
					b.position.x,
					b.position.y,
					b.position.z,
					b.quaternion.x,
					b.quaternion.y,
					b.quaternion.z,
					b.quaternion.w,
				].map(round),
			),
		);

	record();
	let step = 0;
	while (step < MAX_STEPS) {
		world.step(STEP);
		step++;
		if (step % 2 === 0) record();
		if (step > 20 && bodies.every((b) => b.sleepState === CANNON.Body.SLEEPING))
			break;
	}
	if (step % 2 !== 0) record();

	const faces = bodies.map(readFace);
	const clean =
		faces.every((f) => f.dot > 0.97) &&
		bodies.every((b) => b.position.y < HALF * 1.2);
	const last = frames[frames.length - 1]!;
	const poses: Pose[] = indices.map((_, k) => {
		const o = k * 7;
		return {
			p: [last[o]!, last[o + 1]!, last[o + 2]!],
			q: [last[o + 3]!, last[o + 4]!, last[o + 5]!, last[o + 6]!],
		};
	});

	return {
		clean,
		roll: {
			indices,
			frames,
			fps: FPS,
			values: faces.map((f) => f.value),
			poses,
		},
	};
}

export function simulateRoll(dice: DieState[]): SimulatedRoll {
	const indices = dice.flatMap((d, i) => (d.held ? [] : [i]));
	let result = runOnce(indices);
	for (let attempt = 1; attempt < MAX_ATTEMPTS && !result.clean; attempt++) {
		result = runOnce(indices);
	}
	return result.roll;
}
