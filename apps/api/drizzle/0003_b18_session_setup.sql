ALTER TABLE "game_sessions" ADD COLUMN "initial_savings" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "savings_term" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_initial_savings_check" CHECK ("game_sessions"."initial_savings" BETWEEN 0 AND 50000000);--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_savings_term_check" CHECK ("game_sessions"."savings_term" BETWEEN 1 AND 3);