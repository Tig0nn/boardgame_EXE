-- Transactional constraint replacement only: no payload, schema version or history rewrite.
-- Fail safely rather than waiting behind live gameplay transactions.
SET LOCAL lock_timeout = '2s';--> statement-breakpoint
-- Allow this maintenance-only scan of existing snapshots; runtime stays at 5 seconds.
SET LOCAL statement_timeout = '60s';--> statement-breakpoint
ALTER TABLE "public"."game_snapshots" DROP CONSTRAINT "game_snapshots_schema_version_check";--> statement-breakpoint
ALTER TABLE "public"."game_snapshots" ADD CONSTRAINT "game_snapshots_schema_version_check" CHECK (
    "game_snapshots"."schema_version" > 0
    AND ("game_snapshots"."payload"::jsonb @> jsonb_build_object('schemaVersion', "game_snapshots"."schema_version")) IS TRUE
  );
