ALTER TABLE "uploads" ADD COLUMN "processing_lease_id" uuid;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "processing_lease_expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "uploads"
SET "status" = 'uploaded', "failure_code" = null, "updated_at" = now()
WHERE "status" = 'processing';--> statement-breakpoint
CREATE INDEX "uploads_processing_lease_expiration_index" ON "uploads" USING btree ("status","processing_lease_expires_at","id");--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_processing_lease_state_check" CHECK (("uploads"."status" = 'processing' and "uploads"."processing_lease_id" is not null and "uploads"."processing_lease_expires_at" is not null and "uploads"."processing_attempts" > 0) or ("uploads"."status" <> 'processing' and "uploads"."processing_lease_id" is null and "uploads"."processing_lease_expires_at" is null));
