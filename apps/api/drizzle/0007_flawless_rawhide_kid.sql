CREATE TABLE "audio_transcripts" (
	"upload_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"model" varchar(100) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audio_transcripts_text_not_blank_check" CHECK (length(btrim("audio_transcripts"."text")) > 0),
	CONSTRAINT "audio_transcripts_model_not_blank_check" CHECK (length(btrim("audio_transcripts"."model")) > 0)
);
--> statement-breakpoint
ALTER TABLE "audio_transcripts" ADD CONSTRAINT "audio_transcripts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_transcripts" ADD CONSTRAINT "audio_transcripts_upload_owner_fk" FOREIGN KEY ("user_id","upload_id") REFERENCES "public"."uploads"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audio_transcripts_user_id_created_at_index" ON "audio_transcripts" USING btree ("user_id","created_at" DESC NULLS LAST);