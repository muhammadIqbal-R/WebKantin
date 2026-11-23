-- Operator only, once after setup/upgrade. Creates no Auth account or public signup role.
-- Create your own verified Auth user first. Replace admin_email below.
-- If kantin_api already has LOGIN, its existing password is preserved by default.
BEGIN;
SELECT set_config('kantin.actor_kind','maintenance',true),set_config('kantin.request_id',gen_random_uuid()::text,true);
DO $bootstrap$
DECLARE admin_email text:='REPLACE_ADMIN_EMAIL'; api_password text:=$password$REPLACE_FIRST_SETUP_PASSWORD$password$; actor uuid; has_login boolean;
BEGIN
 IF admin_email LIKE 'REPLACE%' THEN RAISE EXCEPTION 'Set admin_email to the existing Auth account email'; END IF;
 SELECT id INTO actor FROM auth.users WHERE lower(email)=lower(btrim(admin_email)) AND (banned_until IS NULL OR banned_until<=now());
 IF actor IS NULL THEN RAISE EXCEPTION 'Create the active admin Auth account first'; END IF;
 IF EXISTS(SELECT 1 FROM app_private.users WHERE id=actor AND (role<>'admin_pengelola' OR tenant_id IS NOT NULL)) THEN RAISE EXCEPTION 'Account has another role; no automatic promotion'; END IF;
 INSERT INTO app_private.users(id,email,role,tenant_id,is_active) VALUES(actor,lower(btrim(admin_email)),'admin_pengelola',NULL,true) ON CONFLICT(id) DO NOTHING;
 SELECT rolcanlogin INTO has_login FROM pg_roles WHERE rolname='kantin_api';
 IF NOT coalesce(has_login,false) THEN
  IF api_password LIKE 'REPLACE%' OR char_length(api_password)<24 THEN RAISE EXCEPTION 'For first setup, choose a random API database password of at least 24 characters'; END IF;
  EXECUTE format('ALTER ROLE kantin_api LOGIN PASSWORD %L',api_password);
 END IF;
END $bootstrap$;
COMMIT;
