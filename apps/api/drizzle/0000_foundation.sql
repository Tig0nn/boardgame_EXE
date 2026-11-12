CREATE TYPE "public"."game_result_outcome" AS ENUM('victory', 'defeat', 'insolvent');--> statement-breakpoint
CREATE TYPE "public"."game_session_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_logs_details_check" CHECK (jsonb_typeof("admin_audit_logs"."details") = 'object')
);
--> statement-breakpoint
CREATE TABLE "game_actions" (
	"session_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"action_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"engine_version" text NOT NULL,
	"result_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_actions_session_id_sequence_pk" PRIMARY KEY("session_id","sequence"),
	CONSTRAINT "game_actions_session_key_unique" UNIQUE("session_id","idempotency_key"),
	CONSTRAINT "game_actions_sequence_check" CHECK ("game_actions"."sequence" > 0),
	CONSTRAINT "game_actions_payload_check" CHECK (jsonb_typeof("game_actions"."payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "game_results" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"state_version" integer NOT NULL,
	"outcome" "game_result_outcome" NOT NULL,
	"lawful_proceeds_vnd" bigint NOT NULL,
	"engine_version" text NOT NULL,
	"result_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_results_final_state_check" CHECK ("game_results"."state_version" > 0),
	CONSTRAINT "game_results_proceeds_check" CHECK ("game_results"."lawful_proceeds_vnd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scenario_id" text NOT NULL,
	"scenario_version" text NOT NULL,
	"creation_key" uuid NOT NULL,
	"seed" text NOT NULL,
	"status" "game_session_status" DEFAULT 'active' NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_sessions_user_creation_key_unique" UNIQUE("user_id","creation_key"),
	CONSTRAINT "game_sessions_state_version_check" CHECK ("game_sessions"."state_version" >= 0),
	CONSTRAINT "game_sessions_seed_check" CHECK ("game_sessions"."seed" ~ '^[0-9a-f]{32}$')
);
--> statement-breakpoint
CREATE TABLE "game_snapshots" (
	"session_id" uuid NOT NULL,
	"state_version" integer NOT NULL,
	"schema_version" integer NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_snapshots_session_id_state_version_pk" PRIMARY KEY("session_id","state_version"),
	CONSTRAINT "game_snapshots_state_version_check" CHECK ("game_snapshots"."state_version" >= 0),
	CONSTRAINT "game_snapshots_schema_version_check" CHECK (
    "game_snapshots"."schema_version" > 0
    AND jsonb_typeof("game_snapshots"."payload"::jsonb) = 'object'
    AND ("game_snapshots"."payload"::jsonb->'schemaVersion' = to_jsonb("game_snapshots"."schema_version")) IS TRUE
  )
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_versions" (
	"scenario_id" text NOT NULL,
	"version" text NOT NULL,
	"gameplay_profile" text NOT NULL,
	"engine_version" text NOT NULL,
	"result_version" text NOT NULL,
	"tile_count" integer NOT NULL,
	"lap_count" integer NOT NULL,
	CONSTRAINT "scenario_versions_scenario_id_version_pk" PRIMARY KEY("scenario_id","version"),
	CONSTRAINT "scenario_versions_dimensions_check" CHECK ("scenario_versions"."tile_count" > 0 AND "scenario_versions"."lap_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_profiles_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_actions" ADD CONSTRAINT "game_actions_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_final_snapshot_fk" FOREIGN KEY ("session_id","state_version") REFERENCES "public"."game_snapshots"("session_id","state_version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_scenario_version_fk" FOREIGN KEY ("scenario_id","scenario_version") REFERENCES "public"."scenario_versions"("scenario_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_snapshots" ADD CONSTRAINT "game_snapshots_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_actor_created_idx" ON "admin_audit_logs" USING btree ("actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "admin_audit_logs_target_idx" ON "admin_audit_logs" USING btree ("target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "game_sessions_user_created_idx" ON "game_sessions" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "game_sessions_scenario_idx" ON "game_sessions" USING btree ("scenario_id","scenario_version");