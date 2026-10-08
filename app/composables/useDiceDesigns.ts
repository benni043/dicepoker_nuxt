import type {
	DesignSettings,
	DiceImage,
	DiceLayout,
	DicePreset,
	LobbyDesign,
	PublicDicePreset,
} from "#shared/types";

const TEXTURE_SIZE = 256;

const images = ref<DiceImage[]>([]);
const presets = ref<DicePreset[]>([]);
const settings = ref<DesignSettings>({
	defaultPresetId: null,
	alwaysOwn: false,
});
let loading: Promise<void> | null = null;
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const diceImageUrl = (id: string) => `/api/dice/images/${id}`;

async function toSquareWebp(file: File): Promise<Blob> {
	const bitmap = await createImageBitmap(file);
	const side = Math.min(bitmap.width, bitmap.height);
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = TEXTURE_SIZE;
	canvas
		.getContext("2d")!
		.drawImage(
			bitmap,
			(bitmap.width - side) / 2,
			(bitmap.height - side) / 2,
			side,
			side,
			0,
			0,
			TEXTURE_SIZE,
			TEXTURE_SIZE,
		);
	bitmap.close();
	return await new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
			"image/webp",
			0.9,
		),
	);
}

function replacePreset(preset: DicePreset) {
	presets.value = presets.value.map((p) => (p.id === preset.id ? preset : p));
}

export function useDiceDesigns() {
	const ownLayout = computed<DiceLayout | null>(
		() =>
			presets.value.find((p) => p.id === settings.value.defaultPresetId)
				?.layout ?? null,
	);

	function layoutFor(lobbyDesign: LobbyDesign | null | undefined) {
		if (settings.value.alwaysOwn) return ownLayout.value;
		return lobbyDesign?.layout ?? ownLayout.value;
	}

	function load() {
		loading ??= Promise.all([
			$fetch<DiceImage[]>("/api/dice/images"),
			$fetch<{ presets: DicePreset[]; settings: DesignSettings }>(
				"/api/dice/presets",
			),
		])
			.then(([imageList, data]) => {
				images.value = imageList;
				presets.value = data.presets;
				settings.value = data.settings;
			})
			.catch(() => {
				loading = null;
			});
		return loading;
	}

	async function upload(file: File) {
		const body = new FormData();
		const name = file.name.replace(/\.[^.]+$/, "") || "image";
		body.append("file", await toSquareWebp(file), `${name}.webp`);
		const image = await $fetch<DiceImage>("/api/dice/images", {
			method: "POST",
			body,
		});
		images.value = [...images.value, image];
		return image;
	}

	async function removeImage(id: string) {
		await $fetch(`/api/dice/images/${id}`, { method: "DELETE" });
		images.value = images.value.filter((i) => i.id !== id);
		presets.value = presets.value.map((p) => ({
			...p,
			layout: p.layout.map((die) =>
				die.map((face) => (face === id ? null : face)),
			),
		}));
	}

	async function createPreset(name: string) {
		const preset = await $fetch<DicePreset>("/api/dice/presets", {
			method: "POST",
			body: { name },
		});
		presets.value = [...presets.value, preset];
		return preset;
	}

	async function updatePreset(
		id: string,
		changes: Partial<Pick<DicePreset, "name" | "isPublic">>,
	) {
		replacePreset(
			await $fetch<DicePreset>(`/api/dice/presets/${id}`, {
				method: "PATCH",
				body: changes,
			}),
		);
	}

	function paint(
		id: string,
		cells: [die: number, face: number][],
		imageId: string | null,
	) {
		const preset = presets.value.find((p) => p.id === id);
		if (!preset) return;
		const layout = preset.layout.map((die) => [...die]);
		for (const [die, face] of cells) layout[die]![face] = imageId;
		replacePreset({ ...preset, layout });
		clearTimeout(saveTimers.get(id));
		saveTimers.set(
			id,
			setTimeout(() => {
				saveTimers.delete(id);
				$fetch(`/api/dice/presets/${id}`, {
					method: "PATCH",
					body: { layout },
				});
			}, 400),
		);
	}

	async function deletePreset(id: string) {
		await $fetch(`/api/dice/presets/${id}`, { method: "DELETE" });
		presets.value = presets.value.filter((p) => p.id !== id);
		if (settings.value.defaultPresetId === id)
			settings.value = { ...settings.value, defaultPresetId: null };
	}

	async function updateSettings(changes: Partial<DesignSettings>) {
		settings.value = { ...settings.value, ...changes };
		await $fetch("/api/dice/settings", { method: "PATCH", body: changes });
	}

	const searchPublic = (q: string) =>
		$fetch<PublicDicePreset[]>("/api/dice/presets/public", { query: { q } });

	async function importPreset(id: string) {
		const preset = await $fetch<DicePreset>(`/api/dice/presets/${id}/import`, {
			method: "POST",
		});
		presets.value = [...presets.value, preset];
		const list = await $fetch<DiceImage[]>("/api/dice/images");
		images.value = list;
		return preset;
	}

	return {
		images,
		presets,
		settings,
		ownLayout,
		layoutFor,
		load,
		upload,
		removeImage,
		createPreset,
		updatePreset,
		paint,
		deletePreset,
		updateSettings,
		searchPublic,
		importPreset,
	};
}
