<script setup lang="ts">
	import { DICE_COUNT } from "#shared/game";
	import type { DicePreset } from "#shared/types";
	import { diceImageUrl } from "~/composables/useDiceDesigns";

	const props = defineProps<{ preset: DicePreset }>();

	const { t } = useI18n();
	const { images, upload, removeImage, paint } = useDiceDesigns();

	const brush = ref<string | null>(null);
	const uploading = ref(false);
	const error = ref("");

	const DICE = Array.from({ length: DICE_COUNT }, (_, i) => i);
	const FACES = [0, 1, 2, 3, 4, 5];

	type Cell = [die: number, face: number];
	const paintCells = (cells: Cell[]) =>
		paint(props.preset.id, cells, brush.value);
	const paintCell = (die: number, face: number) => paintCells([[die, face]]);
	const paintDie = (die: number) =>
		paintCells(FACES.map((f): Cell => [die, f]));
	const paintFace = (face: number) =>
		paintCells(DICE.map((d): Cell => [d, face]));
	const paintAll = () =>
		paintCells(DICE.flatMap((d) => FACES.map((f): Cell => [d, f])));

	const imageOf = (die: number, face: number) => {
		const id = props.preset.layout[die]?.[face];
		return id ? diceImageUrl(id) : null;
	};

	async function onFiles(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = "";
		if (!files.length) return;
		uploading.value = true;
		error.value = "";
		try {
			for (const file of files) brush.value = (await upload(file)).id;
		} catch (e) {
			const code = (e as { statusMessage?: string }).statusMessage;
			error.value =
				code === "TOO_MANY_IMAGES"
					? t("designs.tooManyImages")
					: code === "IMAGE_TOO_LARGE"
						? t("designs.tooLarge")
						: t("designs.uploadFailed");
		} finally {
			uploading.value = false;
		}
	}

	async function deleteImage(id: string) {
		if (!confirm(t("designs.deleteImageConfirm"))) return;
		await removeImage(id);
		if (brush.value === id) brush.value = null;
	}

	const tile =
		"relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-[10px] bg-die transition";
	const brushRing = (active: boolean) =>
		active
			? "ring-3 ring-gold"
			: "ring-1 ring-line hover:ring-2 hover:ring-muted";
	const headerButton =
		"cursor-pointer rounded-md px-1.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-3 hover:text-ink";
</script>

<template>
	<div>
		<p class="mb-3 text-sm text-muted">{{ $t("designs.editorHint") }}</p>

		<div class="mb-1.5 text-sm text-muted">{{ $t("designs.brush") }}</div>
		<div class="mb-5 flex flex-wrap gap-2.5 p-1">
			<button
				type="button"
				:class="[tile, brushRing(brush === null)]"
				:title="$t('designs.standard')"
				@click="brush = null"
			>
				<DieFace :value="5" />
			</button>
			<div v-for="img in images" :key="img.id" class="relative">
				<button
					type="button"
					:class="[tile, brushRing(brush === img.id)]"
					:title="img.name"
					@click="brush = img.id"
				>
					<DieFace :value="1" :image="diceImageUrl(img.id)" />
				</button>
				<button
					type="button"
					class="absolute -top-1.5 -right-1.5 grid size-5 cursor-pointer place-items-center rounded-full bg-danger text-xs font-bold text-bg opacity-90 hover:opacity-100"
					:title="$t('designs.deleteImage')"
					@click="deleteImage(img.id)"
				>
					✕
				</button>
			</div>
			<label
				class="grid size-14 shrink-0 cursor-pointer place-items-center rounded-[10px] border-2 border-dashed border-line text-2xl text-muted transition-colors hover:border-accent hover:text-accent has-focus-visible:border-accent"
				:class="{ 'pointer-events-none opacity-50': uploading }"
				:title="$t('designs.upload')"
			>
				<input
					type="file"
					accept="image/png,image/jpeg,image/webp"
					multiple
					class="sr-only"
					@change="onFiles"
				>
				{{ uploading ? "…" : "+" }}
			</label>
		</div>
		<p v-if="error" class="mb-3 text-sm text-danger">{{ error }}</p>

		<div class="overflow-x-auto">
			<table class="border-separate border-spacing-1.5">
				<thead>
					<tr>
						<th>
							<button
								type="button"
								:class="headerButton"
								:title="$t('designs.paintAll')"
								@click="paintAll"
							>
								{{ $t("designs.all") }}
							</button>
						</th>
						<th v-for="face in FACES" :key="face">
							<button
								type="button"
								:class="headerButton"
								:title="$t('designs.paintFace', { face: face + 1 })"
								@click="paintFace(face)"
							>
								{{ $t("designs.face", { n: face + 1 }) }}
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="die in DICE" :key="die">
						<th class="text-left">
							<button
								type="button"
								:class="headerButton"
								class="whitespace-nowrap"
								:title="$t('designs.paintDie', { n: die + 1 })"
								@click="paintDie(die)"
							>
								{{ $t("designs.die", { n: die + 1 }) }}
							</button>
						</th>
						<td v-for="face in FACES" :key="face">
							<button
								type="button"
								class="block size-11 cursor-pointer overflow-hidden rounded-lg bg-die shadow-[0_2px_0_var(--color-die-edge)] transition hover:ring-2 hover:ring-accent"
								:aria-label="`${$t('designs.die', { n: die + 1 })}, ${$t('designs.face', { n: face + 1 })}`"
								@click="paintCell(die, face)"
							>
								<DieFace :value="face + 1" :image="imageOf(die, face)" />
							</button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>
