CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"professional_id" text NOT NULL,
	"professional_name" text NOT NULL,
	"date" text NOT NULL,
	"time_slot" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"total_duration_minutes" integer NOT NULL,
	"original_amount" numeric(10, 2) NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"final_amount" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"brand" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"cost_price" numeric(10, 2),
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"min_stock_alert" integer DEFAULT 5 NOT NULL,
	"commission_percentage" integer DEFAULT 0,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"nickname" text,
	"role_title" text DEFAULT 'Master Barber' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '5.00' NOT NULL,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"photo_url" text,
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"commission_rate" numeric(4, 2) DEFAULT '0.40' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"working_hours" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"phone" text,
	"role" text DEFAULT 'client' NOT NULL,
	"avatar_url" text,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"loyalty_tier" text DEFAULT 'Bronze' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"category_slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"is_combo" boolean DEFAULT false NOT NULL,
	"original_price" numeric(10, 2),
	"discount_percentage" integer DEFAULT 0,
	"is_popular" boolean DEFAULT false NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "waiting_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"professional_id" text,
	"service_title" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"estimated_wait_minutes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_queue" ADD CONSTRAINT "waiting_queue_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_queue" ADD CONSTRAINT "waiting_queue_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE no action ON UPDATE no action;