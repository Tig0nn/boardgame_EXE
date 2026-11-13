ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.scenario_versions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.scenario_versions FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.game_sessions FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.game_actions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.game_actions FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.game_snapshots ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.game_snapshots FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.game_results FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.admin_audit_logs FROM PUBLIC;
--> statement-breakpoint
DO $$
DECLARE
  api_role text;
BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.profiles, public.scenario_versions, public.game_sessions, public.game_actions, public.game_snapshots, public.game_results, public.admin_audit_logs FROM %I',
      api_role
    );
  END LOOP;
END $$;
--> statement-breakpoint
CREATE POLICY exe_runtime_select ON public.profiles FOR SELECT USING (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_insert ON public.profiles FOR INSERT WITH CHECK (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_select ON public.scenario_versions FOR SELECT USING (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_select ON public.game_sessions FOR SELECT USING (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_insert ON public.game_sessions FOR INSERT WITH CHECK (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_update ON public.game_sessions FOR UPDATE USING (current_user = 'exe_runtime') WITH CHECK (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_select ON public.game_actions FOR SELECT USING (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_insert ON public.game_actions FOR INSERT WITH CHECK (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_select ON public.game_snapshots FOR SELECT USING (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_insert ON public.game_snapshots FOR INSERT WITH CHECK (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_select ON public.game_results FOR SELECT USING (current_user = 'exe_runtime');
--> statement-breakpoint
CREATE POLICY exe_runtime_insert ON public.game_results FOR INSERT WITH CHECK (current_user = 'exe_runtime');
