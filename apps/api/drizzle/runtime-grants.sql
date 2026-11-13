-- Run as the migration owner after provisioning an exe_runtime login with no inherited privileges.
GRANT USAGE ON SCHEMA public TO exe_runtime;
GRANT SELECT ON public.scenario_versions TO exe_runtime;
GRANT SELECT, INSERT ON public.profiles, public.game_actions, public.game_snapshots, public.game_results TO exe_runtime;
GRANT SELECT, INSERT, UPDATE ON public.game_sessions TO exe_runtime;
