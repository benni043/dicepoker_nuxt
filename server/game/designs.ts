import { and, asc, count, desc, eq, ilike, inArray, ne } from "drizzle-orm";
import { DICE_COUNT } from "#shared/game";
import type {
	DesignSettings,
	DiceImage,
	DiceLayout,
	DicePreset,
	PublicDicePreset,
} from "#shared/types";
import { dbReady, schema, useDb } from "../db";

const { users, diceImages, dicePresets } = schema;

export const MAX_IMAGES = 100;
export const MAX_PRESETS = 30;

const presetColumns = {
	id: dicePresets.id,
	name: dicePresets.name,
	layout: dicePresets.layout,
	isPublic: dicePresets.isPublic,
};

export const emptyLayout = (): DiceLayout =>
	Array.from({ length: DICE_COUNT }, () => Array<string | null>(6).fill(null));

export async function listImages(userId: string): Promise<DiceImage[]> {
	await dbReady();
	return await useDb()
		.select({ id: diceImages.id, name: diceImages.name })
		.from(diceImages)
		.where(eq(diceImages.userId, userId))
		.orderBy(asc(diceImages.createdAt));
}

export async function countImages(userId: string): Promise<number> {
	await dbReady();
	const [row] = await useDb()
		.select({ n: count() })
		.from(diceImages)
		.where(eq(diceImages.userId, userId));
	return row?.n ?? 0;
}

export async function addImage(
	userId: string,
	image: { name: string; mime: string; data: Buffer },
): Promise<DiceImage> {
	await dbReady();
	const [row] = await useDb()
		.insert(diceImages)
		.values({ userId, ...image })
		.returning({ id: diceImages.id, name: diceImages.name });
	return row!;
}

export async function getImage(id: string) {
	await dbReady();
	const [row] = await useDb()
		.select({ mime: diceImages.mime, data: diceImages.data })
		.from(diceImages)
		.where(eq(diceImages.id, id));
	return row ?? null;
}

export async function deleteImage(userId: string, id: string) {
	await dbReady();
	await useDb()
		.delete(diceImages)
		.where(and(eq(diceImages.id, id), eq(diceImages.userId, userId)));
	for (const preset of await listPresets(userId)) {
		if (!preset.layout.some((die) => die.includes(id))) continue;
		await updatePreset(userId, preset.id, {
			layout: preset.layout.map((die) =>
				die.map((face) => (face === id ? null : face)),
			),
		});
	}
}

export async function isValidLayout(userId: string, layout: unknown) {
	if (!Array.isArray(layout) || layout.length !== DICE_COUNT) return false;
	const owned = new Set((await listImages(userId)).map((i) => i.id));
	return layout.every(
		(die) =>
			Array.isArray(die) &&
			die.length === 6 &&
			die.every((face) => face === null || owned.has(face)),
	);
}

export async function listPresets(userId: string): Promise<DicePreset[]> {
	await dbReady();
	return await useDb()
		.select(presetColumns)
		.from(dicePresets)
		.where(eq(dicePresets.userId, userId))
		.orderBy(asc(dicePresets.createdAt));
}

export async function countPresets(userId: string): Promise<number> {
	await dbReady();
	const [row] = await useDb()
		.select({ n: count() })
		.from(dicePresets)
		.where(eq(dicePresets.userId, userId));
	return row?.n ?? 0;
}

export async function getPreset(
	userId: string,
	id: string,
): Promise<DicePreset | null> {
	await dbReady();
	const [row] = await useDb()
		.select(presetColumns)
		.from(dicePresets)
		.where(and(eq(dicePresets.id, id), eq(dicePresets.userId, userId)));
	return row ?? null;
}

export async function createPreset(
	userId: string,
	name: string,
	layout: DiceLayout = emptyLayout(),
): Promise<DicePreset> {
	await dbReady();
	const [row] = await useDb()
		.insert(dicePresets)
		.values({ userId, name, layout })
		.returning(presetColumns);
	return row!;
}

export async function updatePreset(
	userId: string,
	id: string,
	changes: Partial<Pick<DicePreset, "name" | "layout" | "isPublic">>,
): Promise<DicePreset | null> {
	await dbReady();
	const [row] = await useDb()
		.update(dicePresets)
		.set(changes)
		.where(and(eq(dicePresets.id, id), eq(dicePresets.userId, userId)))
		.returning(presetColumns);
	return row ?? null;
}

export async function deletePreset(userId: string, id: string) {
	await dbReady();
	await useDb()
		.delete(dicePresets)
		.where(and(eq(dicePresets.id, id), eq(dicePresets.userId, userId)));
}

export async function searchPublicPresets(
	userId: string,
	query: string,
): Promise<PublicDicePreset[]> {
	await dbReady();
	const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
	return await useDb()
		.select({
			id: dicePresets.id,
			name: dicePresets.name,
			owner: users.name,
			layout: dicePresets.layout,
		})
		.from(dicePresets)
		.innerJoin(users, eq(users.id, dicePresets.userId))
		.where(
			and(
				eq(dicePresets.isPublic, true),
				ne(dicePresets.userId, userId),
				ilike(dicePresets.name, `%${escaped}%`),
			),
		)
		.orderBy(desc(dicePresets.createdAt))
		.limit(20);
}

export class DesignLimitError extends Error {}

export async function importPreset(
	userId: string,
	presetId: string,
): Promise<DicePreset | null> {
	await dbReady();
	const db = useDb();
	const [source] = await db
		.select({ name: dicePresets.name, layout: dicePresets.layout })
		.from(dicePresets)
		.where(and(eq(dicePresets.id, presetId), eq(dicePresets.isPublic, true)));
	if (!source) return null;

	const imageIds = [
		...new Set(source.layout.flat().filter((id): id is string => !!id)),
	];
	if ((await countPresets(userId)) >= MAX_PRESETS)
		throw new DesignLimitError("TOO_MANY_PRESETS");
	if ((await countImages(userId)) + imageIds.length > MAX_IMAGES)
		throw new DesignLimitError("TOO_MANY_IMAGES");

	return await db.transaction(async (tx) => {
		const originals = imageIds.length
			? await tx
					.select()
					.from(diceImages)
					.where(inArray(diceImages.id, imageIds))
			: [];
		const copies = new Map<string, string>();
		for (const image of originals) {
			const [copy] = await tx
				.insert(diceImages)
				.values({
					userId,
					name: image.name,
					mime: image.mime,
					data: image.data,
				})
				.returning({ id: diceImages.id });
			copies.set(image.id, copy!.id);
		}
		const layout = source.layout.map((die) =>
			die.map((face) => (face ? (copies.get(face) ?? null) : null)),
		);
		const [preset] = await tx
			.insert(dicePresets)
			.values({ userId, name: source.name, layout })
			.returning(presetColumns);
		return preset!;
	});
}

export async function getDesignSettings(
	userId: string,
): Promise<DesignSettings> {
	await dbReady();
	const [row] = await useDb()
		.select({
			defaultPresetId: users.defaultPresetId,
			alwaysOwn: users.alwaysOwnDesign,
		})
		.from(users)
		.where(eq(users.id, userId));
	return row ?? { defaultPresetId: null, alwaysOwn: false };
}

export async function updateDesignSettings(
	userId: string,
	changes: Partial<DesignSettings>,
) {
	await dbReady();
	await useDb()
		.update(users)
		.set({
			...(changes.defaultPresetId !== undefined && {
				defaultPresetId: changes.defaultPresetId,
			}),
			...(changes.alwaysOwn !== undefined && {
				alwaysOwnDesign: changes.alwaysOwn,
			}),
		})
		.where(eq(users.id, userId));
}
