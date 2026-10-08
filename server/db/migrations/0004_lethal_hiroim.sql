WITH "created" AS (
	INSERT INTO "dice_presets" ("user_id", "name", "layout")
	SELECT "id", 'Mein Design', "dice_layout" FROM "users" WHERE "dice_layout" IS NOT NULL
	RETURNING "id", "user_id"
)
UPDATE "users" SET "default_preset_id" = "created"."id" FROM "created" WHERE "users"."id" = "created"."user_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "dice_layout";
