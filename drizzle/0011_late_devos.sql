CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"tier" text NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "action_id" uuid;--> statement-breakpoint
ALTER TABLE "slack_configs" ADD COLUMN "slack_user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_events_provider_model_created_at_idx" ON "cost_events" USING btree ("provider","model","created_at");--> statement-breakpoint
CREATE INDEX "cost_events_action_id_idx" ON "cost_events" USING btree ("action_id");