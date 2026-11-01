CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"opening_balance_minor" bigint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_user_id_id_currency_code_unique" UNIQUE("user_id","id","currency_code"),
	CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" in ('cash', 'checking', 'savings', 'credit', 'investment', 'other')),
	CONSTRAINT "accounts_currency_code_format_check" CHECK ("accounts"."currency_code" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_user_id_id_type_unique" UNIQUE("user_id","id","type"),
	CONSTRAINT "categories_type_check" CHECK ("categories"."type" in ('income', 'expense'))
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"type" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"occurred_on" date NOT NULL,
	"description" text NOT NULL,
	"counterparty" text,
	"notes" text,
	"origin" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_type_check" CHECK ("transactions"."type" in ('income', 'expense')),
	CONSTRAINT "transactions_origin_check" CHECK ("transactions"."origin" in ('manual', 'document', 'voice')),
	CONSTRAINT "transactions_amount_minor_positive_check" CHECK ("transactions"."amount_minor" > 0),
	CONSTRAINT "transactions_currency_code_format_check" CHECK ("transactions"."currency_code" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"default_currency" varchar(3) NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_default_currency_format_check" CHECK ("users"."default_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_owner_currency_fk" FOREIGN KEY ("user_id","account_id","currency_code") REFERENCES "public"."accounts"("user_id","id","currency_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_owner_type_fk" FOREIGN KEY ("user_id","category_id","type") REFERENCES "public"."categories"("user_id","id","type") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_index" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_id_type_name_active_unique" ON "categories" USING btree ("user_id","type",lower("name")) WHERE "categories"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "categories_user_id_index" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_user_id_occurred_on_index" ON "transactions" USING btree ("user_id","occurred_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_user_id_account_id_occurred_on_index" ON "transactions" USING btree ("user_id","account_id","occurred_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_user_id_category_id_occurred_on_index" ON "transactions" USING btree ("user_id","category_id","occurred_on" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));