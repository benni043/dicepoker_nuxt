CREATE TABLE "dice_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"layout" jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_preset_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "always_own_design" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dice_presets" ADD CONSTRAINT "dice_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dice_presets_user_idx" ON "dice_presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dice_presets_public_idx" ON "dice_presets" USING btree ("is_public");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_preset_id_dice_presets_id_fk" FOREIGN KEY ("default_preset_id") REFERENCES "public"."dice_presets"("id") ON DELETE set null ON UPDATE no action;