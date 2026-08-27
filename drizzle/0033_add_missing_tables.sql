CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"included_services" jsonb DEFAULT '[]' NOT NULL,
	"product_discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"barber_per_cut_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"active_subscribers_count" integer DEFAULT 0 NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"description" text,
	"features" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "subscription_members" (
	"id" text PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"plan_name" text NOT NULL,
	"plan_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_date" text NOT NULL,
	"next_billing_date" text NOT NULL,
	"cuts_used_this_month" integer DEFAULT 0 NOT NULL,
	"monthly_limit" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"user" text NOT NULL,
	"date" text NOT NULL,
	"details" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "appointment_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text,
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"service_title" text NOT NULL,
	"professional_name" text NOT NULL,
	"date" text NOT NULL,
	"time_slot" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "appointments" ADD COLUMN "client_email" text;

DO $$ BEGIN
 ALTER TABLE "subscription_members" ADD CONSTRAINT "subscription_members_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
