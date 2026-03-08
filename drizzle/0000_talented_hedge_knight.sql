CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"action_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload_json" jsonb NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"approved_by" text,
	"rejected_by" text,
	"result_json" jsonb,
	"error_message" text,
	"environment" text,
	"source_framework" text
);
