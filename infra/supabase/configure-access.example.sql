-- Run AFTER setup.sql. Create the two accounts in Supabase Authentication first.
-- Replace these three values locally. Do not commit the version containing a password.
BEGIN;
SELECT set_config('kantin.actor_kind','maintenance',true);
SELECT set_config('kantin.request_id',gen_random_uuid()::text,true);
DO $configure$
DECLARE
  api_password text := $password$REPLACE_WITH_RANDOM_API_PASSWORD$password$;
  admin_email text := 'REPLACE_ADMIN_EMAIL';
  tenant_email text := 'REPLACE_TENANT_EMAIL';
  admin_id uuid; tenant_user_id uuid;
  initial_tenant uuid := '20000000-0000-4000-8000-000000000001';
BEGIN
  IF api_password LIKE 'REPLACE%' OR char_length(api_password)<24 THEN
    RAISE EXCEPTION 'Replace api_password with a random password of at least 24 characters';
  END IF;
  IF admin_email LIKE 'REPLACE%' OR tenant_email LIKE 'REPLACE%' OR lower(admin_email)=lower(tenant_email) THEN
    RAISE EXCEPTION 'Set two different emails matching accounts already created in Supabase Auth';
  END IF;
  SELECT id INTO admin_id FROM auth.users WHERE lower(email)=lower(btrim(admin_email));
  SELECT id INTO tenant_user_id FROM auth.users WHERE lower(email)=lower(btrim(tenant_email));
  IF admin_id IS NULL OR tenant_user_id IS NULL THEN
    RAISE EXCEPTION 'Create the admin and tenant Auth accounts first; this script does not create Auth users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=initial_tenant) THEN
    RAISE EXCEPTION 'Initial tenant is missing; run setup.sql first';
  END IF;
  IF EXISTS (SELECT 1 FROM app_private.users WHERE id=admin_id AND (role<>'admin_pengelola' OR tenant_id IS NOT NULL))
    OR EXISTS (SELECT 1 FROM app_private.users WHERE id=tenant_user_id AND (role<>'tenant' OR tenant_id<>initial_tenant)) THEN
    RAISE EXCEPTION 'An account already has another scope; inspect before changing its privileges';
  END IF;
  INSERT INTO app_private.users(id,role,tenant_id,email) VALUES
    (admin_id,'admin_pengelola',NULL,lower(btrim(admin_email))),
    (tenant_user_id,'tenant',initial_tenant,lower(btrim(tenant_email)))
  ON CONFLICT (id) DO NOTHING;
  EXECUTE format('ALTER ROLE kantin_api LOGIN PASSWORD %L',api_password);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO kantin_api',current_database());
END
$configure$;
COMMIT;

