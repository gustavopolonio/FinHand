CREATE TABLE "document_capture_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"upload_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_capture_sessions_upload_id_unique" UNIQUE("upload_id"),
	CONSTRAINT "document_capture_sessions_status_check" CHECK ("document_capture_sessions"."status" in ('pending', 'consumed', 'expired', 'cancelled')),
	CONSTRAINT "document_capture_sessions_token_hash_format_check" CHECK ("document_capture_sessions"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "document_capture_sessions_expiration_check" CHECK ("document_capture_sessions"."expires_at" > "document_capture_sessions"."created_at"),
	CONSTRAINT "document_capture_sessions_consumption_state_check" CHECK (("document_capture_sessions"."status" = 'consumed' and "document_capture_sessions"."upload_id" is not null and "document_capture_sessions"."consumed_at" is not null) or ("document_capture_sessions"."status" <> 'consumed' and "document_capture_sessions"."upload_id" is null and "document_capture_sessions"."consumed_at" is null))
);
--> statement-breakpoint
CREATE TABLE "transaction_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"upload_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"account_id" uuid,
	"category_id" uuid,
	"type" text,
	"amount_minor" bigint,
	"currency_code" varchar(3),
	"occurred_on" date,
	"description" text,
	"counterparty" text,
	"notes" text,
	"extraction_metadata" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_candidates_upload_id_position_unique" UNIQUE("upload_id","position"),
	CONSTRAINT "transaction_candidates_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "transaction_candidates_status_check" CHECK ("transaction_candidates"."status" in ('pending', 'confirmed', 'rejected')),
	CONSTRAINT "transaction_candidates_type_check" CHECK ("transaction_candidates"."type" is null or "transaction_candidates"."type" in ('income', 'expense')),
	CONSTRAINT "transaction_candidates_amount_minor_positive_check" CHECK ("transaction_candidates"."amount_minor" is null or "transaction_candidates"."amount_minor" > 0),
	CONSTRAINT "transaction_candidates_currency_code_format_check" CHECK ("transaction_candidates"."currency_code" is null or "transaction_candidates"."currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "transaction_candidates_position_nonnegative_check" CHECK ("transaction_candidates"."position" >= 0),
	CONSTRAINT "transaction_candidates_account_currency_check" CHECK ("transaction_candidates"."account_id" is null or "transaction_candidates"."currency_code" is not null),
	CONSTRAINT "transaction_candidates_category_type_check" CHECK ("transaction_candidates"."category_id" is null or "transaction_candidates"."type" is not null),
	CONSTRAINT "transaction_candidates_review_state_check" CHECK (("transaction_candidates"."status" = 'pending' and "transaction_candidates"."reviewed_at" is null and "transaction_candidates"."transaction_id" is null) or ("transaction_candidates"."status" = 'rejected' and "transaction_candidates"."reviewed_at" is not null and "transaction_candidates"."transaction_id" is null) or ("transaction_candidates"."status" = 'confirmed' and "transaction_candidates"."reviewed_at" is not null and "transaction_candidates"."transaction_id" is not null)),
	CONSTRAINT "transaction_candidates_confirmed_fields_check" CHECK ("transaction_candidates"."status" <> 'confirmed' or ("transaction_candidates"."account_id" is not null and "transaction_candidates"."type" is not null and "transaction_candidates"."amount_minor" is not null and "transaction_candidates"."currency_code" is not null and "transaction_candidates"."occurred_on" is not null and "transaction_candidates"."description" is not null))
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"s3_object_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"checksum_sha256" varchar(64),
	"status" text DEFAULT 'pending' NOT NULL,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "uploads_kind_check" CHECK ("uploads"."kind" in ('document', 'audio')),
	CONSTRAINT "uploads_source_check" CHECK ("uploads"."source" in ('direct', 'qr_capture')),
	CONSTRAINT "uploads_qr_source_document_only_check" CHECK ("uploads"."source" <> 'qr_capture' or "uploads"."kind" = 'document'),
	CONSTRAINT "uploads_status_check" CHECK ("uploads"."status" in ('pending', 'uploaded', 'processing', 'processed', 'failed')),
	CONSTRAINT "uploads_byte_size_positive_check" CHECK ("uploads"."byte_size" > 0),
	CONSTRAINT "uploads_checksum_sha256_format_check" CHECK ("uploads"."checksum_sha256" is null or "uploads"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "uploads_failure_state_check" CHECK (("uploads"."status" = 'failed' and "uploads"."failure_code" is not null) or ("uploads"."status" <> 'failed' and "uploads"."failure_code" is null))
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "document_capture_sessions" ADD CONSTRAINT "document_capture_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_capture_sessions" ADD CONSTRAINT "document_capture_sessions_upload_owner_fk" FOREIGN KEY ("user_id","upload_id") REFERENCES "public"."uploads"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_candidates" ADD CONSTRAINT "transaction_candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_candidates" ADD CONSTRAINT "transaction_candidates_upload_owner_fk" FOREIGN KEY ("user_id","upload_id") REFERENCES "public"."uploads"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_candidates" ADD CONSTRAINT "transaction_candidates_account_owner_currency_fk" FOREIGN KEY ("user_id","account_id","currency_code") REFERENCES "public"."accounts"("user_id","id","currency_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_candidates" ADD CONSTRAINT "transaction_candidates_category_owner_type_fk" FOREIGN KEY ("user_id","category_id","type") REFERENCES "public"."categories"("user_id","id","type") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_candidates" ADD CONSTRAINT "transaction_candidates_transaction_owner_fk" FOREIGN KEY ("user_id","transaction_id") REFERENCES "public"."transactions"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_capture_sessions_token_hash_unique" ON "document_capture_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "document_capture_sessions_user_id_status_index" ON "document_capture_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "document_capture_sessions_expires_at_index" ON "document_capture_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "transaction_candidates_user_id_status_created_at_index" ON "transaction_candidates" USING btree ("user_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transaction_candidates_upload_id_index" ON "transaction_candidates" USING btree ("upload_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_s3_object_key_unique" ON "uploads" USING btree ("s3_object_key");--> statement-breakpoint
CREATE INDEX "uploads_user_id_created_at_index" ON "uploads" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "uploads_user_id_status_index" ON "uploads" USING btree ("user_id","status");
