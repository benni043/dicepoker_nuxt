CREATE TABLE "dice_preset_saves" (
	"user_id" uuid NOT NULL,
	"preset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dice_preset_saves_user_id_preset_id_pk" PRIMARY KEY("user_id","preset_id")
);
--> statement-breakpoint
ALTER TABLE "dice_preset_saves" ADD CONSTRAINT "dice_preset_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dice_preset_saves" ADD CONSTRAINT "dice_preset_saves_preset_id_dice_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."dice_presets"("id") ON DELETE cascade ON UPDATE no action;