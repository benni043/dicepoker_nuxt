<script setup lang="ts">
	import * as THREE from "three";
	import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
	import {
		ARENA_HALF,
		DIE_SIZE,
		idlePose,
		TRAY_Z,
		trayPose,
		WALL_HEIGHT,
	} from "#shared/dice";
	import type { DieState, Pose, RollAnimation } from "#shared/types";

	const props = defineProps<{
		dice: DieState[];
		interactive: boolean;
		fill?: boolean;
	}>();

	const emit = defineEmits<{
		toggle: [index: number];
		settled: [];
	}>();

	const FACE_ORDER = [3, 4, 1, 6, 2, 5];
	const PIPS: Record<number, [number, number][]> = {
		1: [[0.5, 0.5]],
		2: [
			[0.27, 0.27],
			[0.73, 0.73],
		],
		3: [
			[0.27, 0.27],
			[0.5, 0.5],
			[0.73, 0.73],
		],
		4: [
			[0.27, 0.27],
			[0.73, 0.27],
			[0.27, 0.73],
			[0.73, 0.73],
		],
		5: [
			[0.27, 0.27],
			[0.73, 0.27],
			[0.5, 0.5],
			[0.27, 0.73],
			[0.73, 0.73],
		],
		6: [
			[0.27, 0.25],
			[0.73, 0.25],
			[0.27, 0.5],
			[0.73, 0.5],
			[0.27, 0.75],
			[0.73, 0.75],
		],
	};

	const host = ref<HTMLDivElement | null>(null);
	const hovered = ref(-1);

	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let frameId = 0;
	let lastTime = 0;
	let resizeObserver: ResizeObserver | null = null;
	let anim: (RollAnimation & { start: number }) | null = null;
	const meshes: THREE.Mesh[] = [];
	const basePositions: THREE.Vector3[] = [];
	const dieMaterials: THREE.MeshStandardMaterial[][] = [];
	const disposables: { dispose(): void }[] = [];

	const raycaster = new THREE.Raycaster();
	const pointer = new THREE.Vector2();
	const tmpPos = new THREE.Vector3();
	const tmpQuat = new THREE.Quaternion();
	const q0 = new THREE.Quaternion();
	const q1 = new THREE.Quaternion();
	const HELD_GLOW = new THREE.Color("#b07400");
	const HOVER_GLOW = new THREE.Color("#3a4a3f");
	const NO_GLOW = new THREE.Color("#000000");

	function targetPose(i: number): Pose {
		const die = props.dice[i];
		if (!die) return idlePose(i);
		if (die.held) return trayPose(i, die.value);
		return die.pose ?? idlePose(i);
	}

	function faceTexture(value: number) {
		const size = 256;
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext("2d")!;
		ctx.fillStyle = "#f4f1ea";
		ctx.fillRect(0, 0, size, size);
		ctx.fillStyle = value === 1 ? "#c0262d" : "#1a1c22";
		for (const [x, y] of PIPS[value]!) {
			ctx.beginPath();
			ctx.arc(
				x * size,
				y * size,
				size * (value === 1 ? 0.11 : 0.085),
				0,
				Math.PI * 2,
			);
			ctx.fill();
		}
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = 4;
		disposables.push(texture);
		return texture;
	}

	function addMesh<T extends THREE.BufferGeometry, M extends THREE.Material>(
		geometry: T,
		material: M,
	) {
		disposables.push(geometry, material);
		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);
		return mesh;
	}

	function buildScene() {
		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.domElement.className = "block size-full";
		host.value!.appendChild(renderer.domElement);

		scene = new THREE.Scene();
		scene.background = new THREE.Color("#0d0f14");
		camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

		scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1208, 1.1));
		const sun = new THREE.DirectionalLight(0xffffff, 2.4);
		sun.position.set(3, 9, 4);
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		sun.shadow.bias = -0.0005;
		Object.assign(sun.shadow.camera, {
			left: -5,
			right: 5,
			top: 5,
			bottom: -5,
			near: 1,
			far: 25,
		});
		scene.add(sun);

		const table = addMesh(
			new THREE.PlaneGeometry(40, 40),
			new THREE.MeshStandardMaterial({ color: "#14100c", roughness: 0.95 }),
		);
		table.rotation.x = -Math.PI / 2;
		table.position.y = -0.003;
		table.receiveShadow = true;

		const felt = addMesh(
			new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2),
			new THREE.MeshStandardMaterial({ color: "#1d5a3c", roughness: 1 }),
		);
		felt.rotation.x = -Math.PI / 2;
		felt.receiveShadow = true;

		const tray = addMesh(
			new THREE.PlaneGeometry(ARENA_HALF * 2, 1.0),
			new THREE.MeshStandardMaterial({ color: "#2b2219", roughness: 0.8 }),
		);
		tray.rotation.x = -Math.PI / 2;
		tray.position.set(0, -0.001, TRAY_Z);
		tray.receiveShadow = true;

		const thickness = 0.15;
		const length = ARENA_HALF * 2 + thickness * 2;
		const wallMaterial = new THREE.MeshStandardMaterial({
			color: "#4a3424",
			roughness: 0.7,
		});
		const offset = ARENA_HALF + thickness / 2;
		for (const [x, z, rotY] of [
			[0, -offset, 0],
			[0, offset, 0],
			[-offset, 0, Math.PI / 2],
			[offset, 0, Math.PI / 2],
		] as const) {
			const wall = addMesh(
				new THREE.BoxGeometry(length, WALL_HEIGHT, thickness),
				wallMaterial,
			);
			wall.position.set(x, WALL_HEIGHT / 2, z);
			wall.rotation.y = rotY;
			wall.castShadow = wall.receiveShadow = true;
		}

		const dieGeometry = new RoundedBoxGeometry(
			DIE_SIZE,
			DIE_SIZE,
			DIE_SIZE,
			4,
			DIE_SIZE * 0.12,
		);
		disposables.push(dieGeometry);
		const textures = FACE_ORDER.map(faceTexture);
		for (let i = 0; i < props.dice.length; i++) {
			const materials = textures.map(
				(map) => new THREE.MeshStandardMaterial({ map, roughness: 0.35 }),
			);
			disposables.push(...materials);
			const mesh = new THREE.Mesh(dieGeometry, materials);
			mesh.castShadow = true;
			mesh.userData.index = i;
			const pose = targetPose(i);
			mesh.position.set(...pose.p);
			mesh.quaternion.set(...pose.q);
			scene.add(mesh);
			meshes.push(mesh);
			basePositions.push(mesh.position.clone());
			dieMaterials.push(materials);
		}
	}

	function resize() {
		if (!renderer || !host.value) return;
		const { clientWidth: w, clientHeight: h } = host.value;
		if (!w || !h) return;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		const fit = Math.max(1, 1.2 / camera.aspect);
		camera.position.set(0, 8.4 * fit, 5.4 * fit);
		camera.lookAt(0, 0, 0.45);
		camera.updateProjectionMatrix();
	}

	function sampleAnimation(
		a: RollAnimation & { start: number },
		k: number,
		now: number,
		mesh: THREE.Mesh,
	) {
		const last = a.frames.length - 1;
		const f = Math.min(((now - a.start) / 1000) * a.fps, last);
		const i0 = Math.floor(f);
		const i1 = Math.min(i0 + 1, last);
		const t = f - i0;
		const A = a.frames[i0]!;
		const B = a.frames[i1]!;
		const o = k * 7;
		mesh.position.set(
			A[o]! + (B[o]! - A[o]!) * t,
			A[o + 1]! + (B[o + 1]! - A[o + 1]!) * t,
			A[o + 2]! + (B[o + 2]! - A[o + 2]!) * t,
		);
		q0.set(A[o + 3]!, A[o + 4]!, A[o + 5]!, A[o + 6]!);
		q1.set(B[o + 3]!, B[o + 4]!, B[o + 5]!, B[o + 6]!);
		mesh.quaternion.slerpQuaternions(q0, q1, t);
	}

	function tick(now: number) {
		frameId = requestAnimationFrame(tick);
		if (!renderer) return;
		const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0);
		lastTime = now;
		const follow = 1 - Math.exp(-dt * 14);

		meshes.forEach((mesh, i) => {
			const k = anim ? anim.indices.indexOf(i) : -1;
			const base = basePositions[i]!;
			if (anim && k >= 0) {
				sampleAnimation(anim, k, now, mesh);
				base.copy(mesh.position);
			} else {
				const pose = targetPose(i);
				tmpPos.set(...pose.p);
				base.lerp(tmpPos, follow);
				const remaining = Math.hypot(tmpPos.x - base.x, tmpPos.z - base.z);
				mesh.position.copy(base);
				mesh.position.y += Math.min(remaining, 1.2) * 0.9;
				mesh.quaternion.slerp(tmpQuat.set(...pose.q), follow);
			}
			const glow = props.dice[i]?.held
				? HELD_GLOW
				: props.interactive && hovered.value === i
					? HOVER_GLOW
					: NO_GLOW;
			for (const m of dieMaterials[i]!) m.emissive.copy(glow);
		});

		if (
			anim &&
			((now - anim.start) / 1000) * anim.fps >= anim.frames.length - 1
		) {
			anim = null;
			emit("settled");
		}
		renderer.render(scene, camera);
	}

	function pickDie(event: PointerEvent): number {
		if (!renderer) return -1;
		const rect = renderer.domElement.getBoundingClientRect();
		pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1,
		);
		raycaster.setFromCamera(pointer, camera);
		const hit = raycaster.intersectObjects(meshes, false)[0];
		return hit ? (hit.object.userData.index as number) : -1;
	}

	function onPointerMove(event: PointerEvent) {
		hovered.value = props.interactive && !anim ? pickDie(event) : -1;
	}

	function onClick(event: PointerEvent) {
		if (!props.interactive || anim) return;
		const index = pickDie(event);
		if (index >= 0) emit("toggle", index);
	}

	function playRoll(roll: RollAnimation) {
		anim = { ...roll, start: performance.now() };
	}

	defineExpose({ playRoll });

	onMounted(() => {
		buildScene();
		resize();
		resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(host.value!);
		frameId = requestAnimationFrame(tick);
	});

	onBeforeUnmount(() => {
		cancelAnimationFrame(frameId);
		resizeObserver?.disconnect();
		for (const d of disposables) d.dispose();
		renderer?.dispose();
		renderer?.domElement.remove();
		renderer = null;
	});
</script>

<template>
	<!-- biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: clicking dice in 3D is a shortcut; DiceTray offers the same toggles as keyboard-accessible buttons -->
	<div
		ref="host"
		class="w-full overflow-hidden rounded-xl border border-line bg-bg"
		:class="[fill ? 'h-full' : 'aspect-4/3', interactive && hovered >= 0 ? 'cursor-pointer' : '']"
		@pointermove="onPointerMove"
		@pointerleave="hovered = -1"
		@click="onClick"
	/>
</template>
