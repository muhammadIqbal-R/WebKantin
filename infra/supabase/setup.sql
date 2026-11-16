-- GENERATED: full Kantin database + one placeholder tenant. Run once as postgres.
-- Source: apps/api/prisma/migrations/202611120001_initial/migration.sql and prisma/seed.sql
-- Kantin Fakultas: baseline schema. Run as postgres in Supabase SQL Editor.
-- Transactional, first installation only. No DROP TABLE, no passwords, no Auth users.
BEGIN;
SET LOCAL timezone = 'UTC';
DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Run this baseline as the Supabase postgres owner, not as the API role';
  END IF;
  IF to_regnamespace('app_private') IS NOT NULL OR to_regclass('public.tenants') IS NOT NULL
    OR to_regclass('public.orders') IS NOT NULL OR to_regclass('public.outlets') IS NOT NULL
    OR to_regclass('public.menus') IS NOT NULL OR to_regclass('public.order_items') IS NOT NULL THEN
    RAISE EXCEPTION 'Application schema already exists. Nothing changed; use verify.sql, not a reset';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Supabase Auth/Storage schemas are required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('kantin_api','order_tracker')) THEN
    RAISE EXCEPTION 'Reserved application roles already exist; inspect their ownership before installing';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('menu-photos','tenant-qris','floor-maps')) THEN
    RAISE EXCEPTION 'Reserved Storage bucket names are already in use';
  END IF;
END
$preflight$;

CREATE ROLE kantin_api NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE order_tracker NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
-- Never grant kantin_api to authenticator: a browser JWT must not assume that role.
GRANT order_tracker TO authenticator;
GRANT USAGE ON SCHEMA public TO kantin_api, order_tracker;
CREATE SCHEMA app_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role, authenticator;
GRANT USAGE ON SCHEMA app_private TO kantin_api, order_tracker;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TYPE public.order_type AS ENUM ('dine_in','take_away');
CREATE TYPE public.order_status AS ENUM ('menunggu_bayar','menunggu_konfirmasi','diproses','siap','selesai','dibatalkan');
CREATE TYPE public.payment_status AS ENUM ('unpaid','pending_confirmation','paid','rejected');
CREATE TYPE public.payment_method AS ENUM ('qris_static');
CREATE TYPE app_private.app_role AS ENUM ('admin_pengelola','tenant');

CREATE TABLE public.outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100 AND name = btrim(name)),
  location varchar(300) NOT NULL CHECK (char_length(btrim(location)) BETWEEN 2 AND 300),
  floor_map_url varchar(2048) CHECK (floor_map_url IS NULL OR floor_map_url ~ '^https://[^[:space:]]+$'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  name varchar(100) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100 AND name = btrim(name)),
  description varchar(1000) NOT NULL DEFAULT '',
  qris_image_url varchar(2048) CHECK (qris_image_url IS NULL OR qris_image_url ~ '^https://[^[:space:]]+$'),
  qris_merchant_name varchar(150) CHECK (qris_merchant_name IS NULL OR char_length(btrim(qris_merchant_name)) BETWEEN 2 AND 150),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_ready CHECK (NOT is_active OR (qris_image_url IS NOT NULL AND qris_merchant_name IS NOT NULL))
);
CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name varchar(100) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100 AND name = btrim(name)),
  price integer NOT NULL CHECK (price BETWEEN 1 AND 1000000000),
  photo_url varchar(2048) CHECK (photo_url IS NULL OR photo_url ~ '^https://[^[:space:]]+$'),
  is_available boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id)
);
CREATE TABLE app_private.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  role app_private.app_role NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  email varchar(320) NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_scope CHECK ((role = 'tenant' AND tenant_id IS NOT NULL) OR (role = 'admin_pengelola' AND tenant_id IS NULL))
);
CREATE FUNCTION app_private.new_order_code() RETURNS text
LANGUAGE sql VOLATILE SET search_path = '' AS $fn$
  SELECT 'KT-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    1 + get_byte(decode(replace(gen_random_uuid()::text,'-',''),'hex'),0) % 32,1),'')
  FROM generate_series(1,10);
$fn$;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code varchar(13) NOT NULL UNIQUE DEFAULT app_private.new_order_code() CHECK (order_code ~ '^KT-[A-Z0-9]{10}$'),
  customer_name varchar(100) NOT NULL CHECK (char_length(btrim(customer_name)) BETWEEN 2 AND 100 AND customer_name = btrim(customer_name)),
  order_type public.order_type NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  total integer NOT NULL CHECK (total BETWEEN 1 AND 1000000000),
  status public.order_status NOT NULL DEFAULT 'menunggu_bayar',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_method public.payment_method NOT NULL DEFAULT 'qris_static',
  payment_confirmed_by uuid REFERENCES app_private.users(id) ON DELETE RESTRICT,
  payment_confirmed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  CONSTRAINT order_payment_pair CHECK (
    (status = 'menunggu_bayar' AND payment_status IN ('unpaid','rejected')) OR
    (status = 'menunggu_konfirmasi' AND payment_status = 'pending_confirmation') OR
    (status IN ('diproses','siap','selesai') AND payment_status = 'paid') OR
    (status = 'dibatalkan' AND payment_status IN ('unpaid','rejected'))
  ),
  CONSTRAINT payment_audit CHECK (
    (payment_status = 'paid' AND payment_confirmed_by IS NOT NULL AND payment_confirmed_at IS NOT NULL) OR
    (payment_status <> 'paid' AND payment_confirmed_by IS NULL AND payment_confirmed_at IS NULL)
  )
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  menu_id uuid NOT NULL,
  menu_name varchar(100) NOT NULL CHECK (char_length(btrim(menu_name)) BETWEEN 2 AND 100),
  qty integer NOT NULL CHECK (qty BETWEEN 1 AND 99),
  unit_price integer NOT NULL CHECK (unit_price BETWEEN 1 AND 1000000000),
  subtotal integer NOT NULL CHECK (subtotal BETWEEN 1 AND 1000000000 AND subtotal::bigint = qty::bigint * unit_price::bigint),
  UNIQUE (order_id, menu_id),
  FOREIGN KEY (order_id, tenant_id) REFERENCES public.orders(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (menu_id, tenant_id) REFERENCES public.menus(id, tenant_id) ON DELETE RESTRICT
);
CREATE TABLE app_private.checkout_requests (
  idempotency_key uuid PRIMARY KEY,
  request_hash varchar(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response_ciphertext text CHECK (response_ciphertext IS NULL OR (char_length(response_ciphertext) BETWEEN 20 AND 262144 AND response_ciphertext LIKE 'v1:%')),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((completed_at IS NULL) = (response_ciphertext IS NULL)),
  CHECK (expires_at > created_at)
);
CREATE TABLE app_private.checkout_orders (
  order_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  idempotency_key uuid NOT NULL REFERENCES app_private.checkout_requests(idempotency_key) ON DELETE CASCADE,
  UNIQUE (idempotency_key, tenant_id),
  FOREIGN KEY (order_id, tenant_id) REFERENCES public.orders(id, tenant_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE app_private.order_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  token_digest varchar(64) NOT NULL UNIQUE CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, tenant_id) REFERENCES public.orders(id, tenant_id) ON DELETE RESTRICT,
  CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE TABLE app_private.order_payment_snapshots (
  order_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  qris_image_url varchar(2048) NOT NULL CHECK (qris_image_url ~ '^https://[^[:space:]]+$'),
  merchant_name varchar(150) NOT NULL CHECK (char_length(btrim(merchant_name)) BETWEEN 2 AND 150),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, tenant_id) REFERENCES public.orders(id, tenant_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE app_private.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  actor_user_id uuid REFERENCES app_private.users(id) ON DELETE RESTRICT,
  actor_kind varchar(20) NOT NULL,
  action varchar(40) NOT NULL,
  before_state jsonb,
  after_state jsonb NOT NULL,
  reason varchar(300),
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, tenant_id) REFERENCES public.orders(id, tenant_id) ON DELETE RESTRICT
);
CREATE TABLE app_private.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES app_private.users(id) ON DELETE RESTRICT,
  entity_type varchar(30) NOT NULL CHECK (entity_type IN ('outlets','tenants','menus','users')),
  entity_id uuid NOT NULL,
  action varchar(30) NOT NULL CHECK (action IN ('created','updated')),
  before_state jsonb,
  after_state jsonb NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tenants_outlet_idx ON public.tenants(outlet_id,id);
CREATE INDEX menus_tenant_idx ON public.menus(tenant_id,id);
CREATE INDEX orders_tenant_created_idx ON public.orders(tenant_id,created_at,id);
CREATE INDEX orders_tenant_payment_idx ON public.orders(tenant_id,payment_status,created_at,id);
CREATE INDEX order_items_tenant_idx ON public.order_items(tenant_id,order_id);
CREATE INDEX users_tenant_idx ON app_private.users(tenant_id);
CREATE INDEX checkout_requests_expiry_idx ON app_private.checkout_requests(expires_at);
CREATE INDEX checkout_orders_key_idx ON app_private.checkout_orders(idempotency_key);
CREATE INDEX order_events_tenant_idx ON app_private.order_events(tenant_id,created_at);
CREATE INDEX audit_events_tenant_idx ON app_private.audit_events(tenant_id,created_at);

-- Narrow helpers. app_private must NOT be an exposed Data API schema.
CREATE FUNCTION app_private.uuid_or_null(value text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
BEGIN RETURN nullif(value,'')::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END
$fn$;
CREATE FUNCTION app_private.ctx_uuid(setting_name text) RETURNS uuid
LANGUAGE sql STABLE SET search_path = '' AS $fn$
  SELECT app_private.uuid_or_null(current_setting(setting_name,true));
$fn$;
CREATE FUNCTION app_private.ctx_kind() RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $fn$
  SELECT nullif(current_setting('kantin.actor_kind',true),'');
$fn$;
CREATE FUNCTION app_private.require_request_id() RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = '' AS $fn$
DECLARE result uuid := app_private.ctx_uuid('kantin.request_id');
BEGIN
  IF result IS NULL THEN RAISE EXCEPTION 'Missing transaction-local request_id' USING ERRCODE='22023'; END IF;
  RETURN result;
END
$fn$;
CREATE FUNCTION app_private.staff_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT id FROM app_private.users
  WHERE app_private.ctx_kind()='staff' AND id=app_private.ctx_uuid('kantin.actor_id') AND is_active;
$fn$;
CREATE FUNCTION app_private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM app_private.users WHERE id=app_private.staff_id() AND role='admin_pengelola');
$fn$;
CREATE FUNCTION app_private.staff_tenant_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT tenant_id FROM app_private.users WHERE id=app_private.staff_id() AND role='tenant';
$fn$;
CREATE FUNCTION app_private.manage_tenant(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT app_private.is_admin() OR coalesce(app_private.staff_tenant_id()=target,false);
$fn$;
CREATE FUNCTION app_private.catalog_context() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT coalesce(app_private.ctx_kind() IN ('public','checkout','customer') OR app_private.staff_id() IS NOT NULL,false);
$fn$;
CREATE FUNCTION app_private.active_tenant(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.tenants t JOIN public.outlets o ON o.id=t.outlet_id
    WHERE t.id=target AND t.is_active AND o.is_active);
$fn$;
CREATE FUNCTION app_private.valid_checkout() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT coalesce(app_private.ctx_kind()='checkout' AND EXISTS (
    SELECT 1 FROM app_private.checkout_requests
    WHERE idempotency_key=app_private.ctx_uuid('kantin.checkout_id')
      AND request_hash=current_setting('kantin.request_hash',true)
      AND completed_at IS NULL AND expires_at>now()),false);
$fn$;
CREATE FUNCTION app_private.checkout_order(target uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT coalesce(app_private.ctx_kind()='checkout' AND EXISTS (
    SELECT 1 FROM app_private.checkout_orders co
    JOIN app_private.checkout_requests cr USING (idempotency_key)
    WHERE co.order_id=target AND cr.idempotency_key=app_private.ctx_uuid('kantin.checkout_id')
      AND cr.request_hash=current_setting('kantin.request_hash',true) AND cr.expires_at>now()),false);
$fn$;
CREATE FUNCTION app_private.customer_order(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT coalesce(app_private.ctx_kind()='customer' AND target=app_private.ctx_uuid('kantin.order_id') AND EXISTS (
    SELECT 1 FROM app_private.order_access_grants
    WHERE id=app_private.ctx_uuid('kantin.grant_id') AND order_id=target
      AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())),false);
$fn$;
-- Only the API may resolve a SHA-256 digest into a grant ID.
CREATE FUNCTION app_private.resolve_order_grant(target uuid, digest text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT id FROM app_private.order_access_grants WHERE order_id=target AND token_digest=digest
    AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now());
$fn$;
CREATE FUNCTION app_private.resolve_order_access(code text, digest text) RETURNS TABLE(order_id uuid,grant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT o.id,g.id FROM public.orders o JOIN app_private.order_access_grants g ON g.order_id=o.id
  WHERE o.order_code=code AND g.token_digest=digest AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>now());
$fn$;
CREATE FUNCTION app_private.claims() RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = '' AS $fn$
BEGIN RETURN coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
EXCEPTION WHEN invalid_text_representation THEN RETURN '{}'::jsonb; END
$fn$;
CREATE FUNCTION app_private.tracker_order(target uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE c jsonb := app_private.claims(); expiration bigint; issued bigint; epoch_now bigint := extract(epoch FROM now())::bigint;
BEGIN
  IF c->>'role' IS DISTINCT FROM 'order_tracker' OR c->>'purpose' IS DISTINCT FROM 'order_tracking'
    OR app_private.uuid_or_null(c->>'order_id') IS DISTINCT FROM target THEN RETURN false; END IF;
  BEGIN expiration := (c->>'exp')::bigint; issued := (c->>'iat')::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false; END;
  IF expiration IS NULL OR issued IS NULL OR expiration<=epoch_now OR expiration>epoch_now+300
    OR issued>epoch_now+30 OR expiration<=issued OR expiration-issued>300 THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM app_private.order_access_grants
    WHERE id=app_private.uuid_or_null(c->>'jti') AND order_id=target
    AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()));
END
$fn$;

CREATE FUNCTION app_private.touch_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  PERFORM app_private.require_request_id();
  IF TG_OP='UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Identifiers and creation timestamps are immutable' USING ERRCODE='22023';
    END IF;
    IF TG_TABLE_NAME='menus' THEN
      IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
        RAISE EXCEPTION 'Menu tenant cannot be reassigned' USING ERRCODE='22023';
      END IF;
    END IF;
    IF TG_TABLE_NAME='outlets' THEN
      IF OLD.is_active AND NOT NEW.is_active AND EXISTS (SELECT 1 FROM public.tenants WHERE outlet_id=OLD.id AND is_active) THEN
        RAISE EXCEPTION 'Deactivate tenants before their outlet' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSE NEW.created_at:=now(); END IF;
  IF TG_TABLE_NAME='tenants' THEN
    IF NEW.is_active AND NOT EXISTS (SELECT 1 FROM public.outlets WHERE id=NEW.outlet_id AND is_active) THEN
      RAISE EXCEPTION 'Active tenant requires an active outlet' USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END
$fn$;
CREATE TRIGGER outlets_touch BEFORE INSERT OR UPDATE ON public.outlets FOR EACH ROW EXECUTE FUNCTION app_private.touch_record();
CREATE TRIGGER tenants_touch BEFORE INSERT OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION app_private.touch_record();
CREATE TRIGGER menus_touch BEFORE INSERT OR UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION app_private.touch_record();
CREATE TRIGGER users_touch BEFORE INSERT OR UPDATE ON app_private.users FOR EACH ROW EXECUTE FUNCTION app_private.touch_record();

CREATE FUNCTION app_private.audit_catalog() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE previous jsonb; current_state jsonb := to_jsonb(NEW); scope uuid;
BEGIN
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  IF TG_TABLE_NAME='tenants' THEN scope:=NEW.id;
  ELSIF TG_TABLE_NAME IN ('menus','users') THEN scope:=app_private.uuid_or_null(current_state->>'tenant_id');
  END IF;
  INSERT INTO app_private.audit_events(tenant_id,actor_user_id,entity_type,entity_id,action,before_state,after_state,request_id)
  VALUES(scope,app_private.staff_id(),TG_TABLE_NAME,NEW.id,
    CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,
    previous - ARRAY['email','description','created_at','updated_at'],
    current_state - ARRAY['email','description','created_at','updated_at'],
    app_private.require_request_id());
  RETURN NEW;
END
$fn$;
CREATE TRIGGER outlets_audit AFTER INSERT OR UPDATE ON public.outlets FOR EACH ROW EXECUTE FUNCTION app_private.audit_catalog();
CREATE TRIGGER tenants_audit AFTER INSERT OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION app_private.audit_catalog();
CREATE TRIGGER menus_audit AFTER INSERT OR UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION app_private.audit_catalog();
CREATE TRIGGER users_audit AFTER INSERT OR UPDATE ON app_private.users FOR EACH ROW EXECUTE FUNCTION app_private.audit_catalog();

CREATE FUNCTION app_private.checkout_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  PERFORM app_private.require_request_id();
  IF TG_OP='INSERT' THEN
    IF NEW.completed_at IS NOT NULL OR NEW.response_ciphertext IS NOT NULL THEN
      RAISE EXCEPTION 'Create an open checkout before inserting orders' USING ERRCODE='22023';
    END IF;
    NEW.created_at:=now(); NEW.expires_at:=now()+interval '24 hours';
  ELSE
    IF OLD.completed_at IS NOT NULL OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR NEW.request_hash IS DISTINCT FROM OLD.request_hash OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Checkout identity and completed replay are immutable' USING ERRCODE='22023';
    END IF;
    NEW.completed_at:=CASE WHEN NEW.response_ciphertext IS NULL THEN NULL ELSE now() END;
  END IF;
  NEW.updated_at:=now(); RETURN NEW;
END
$fn$;
CREATE TRIGGER checkout_guard BEFORE INSERT OR UPDATE ON app_private.checkout_requests FOR EACH ROW EXECUTE FUNCTION app_private.checkout_guard();

CREATE FUNCTION app_private.order_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE expected integer; reason text := nullif(btrim(current_setting('kantin.rejection_reason',true)),'');
BEGIN
  PERFORM app_private.require_request_id();
  IF TG_OP='INSERT' THEN
    IF NOT app_private.valid_checkout() OR NOT app_private.active_tenant(NEW.tenant_id) THEN
      RAISE EXCEPTION 'Order requires an open checkout and an active tenant' USING ERRCODE='42501';
    END IF;
    IF NEW.status<>'menunggu_bayar' OR NEW.payment_status<>'unpaid' OR NEW.version<>1
      OR NEW.payment_confirmed_by IS NOT NULL OR NEW.payment_confirmed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid initial order state' USING ERRCODE='23514';
    END IF;
    NEW.created_at:=now(); NEW.updated_at:=now(); RETURN NEW;
  END IF;
  IF (NEW.id,NEW.tenant_id,NEW.order_code,NEW.customer_name,NEW.order_type,NEW.total,NEW.payment_method,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.order_code,OLD.customer_name,OLD.order_type,OLD.total,OLD.payment_method,OLD.created_at) THEN
    RAISE EXCEPTION 'Order identity and financial snapshot are immutable' USING ERRCODE='22023';
  END IF;
  BEGIN expected:=nullif(current_setting('kantin.expected_version',true),'')::integer;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN expected:=NULL; END;
  IF expected IS DISTINCT FROM OLD.version THEN
    RAISE EXCEPTION 'Order version conflict' USING ERRCODE='40001';
  END IF;
  IF OLD.status='menunggu_bayar' AND NEW.status='menunggu_konfirmasi' AND app_private.customer_order(OLD.id) THEN
    NEW.payment_status:='pending_confirmation'; NEW.payment_confirmed_by:=NULL; NEW.payment_confirmed_at:=NULL;
  ELSIF app_private.manage_tenant(OLD.tenant_id) THEN
    IF OLD.status='menunggu_konfirmasi' AND NEW.status='diproses' THEN
      NEW.payment_status:='paid'; NEW.payment_confirmed_by:=app_private.staff_id(); NEW.payment_confirmed_at:=now();
    ELSIF OLD.status='menunggu_konfirmasi' AND NEW.status='menunggu_bayar' THEN
      IF reason IS NULL OR char_length(reason) NOT BETWEEN 2 AND 300 THEN
        RAISE EXCEPTION 'Payment rejection needs a reason of 2..300 characters' USING ERRCODE='22023';
      END IF;
      NEW.payment_status:='rejected'; NEW.payment_confirmed_by:=NULL; NEW.payment_confirmed_at:=NULL;
    ELSIF OLD.status IN ('menunggu_bayar','menunggu_konfirmasi') AND NEW.status='dibatalkan' THEN
      NEW.payment_status:=CASE WHEN OLD.payment_status='pending_confirmation' THEN 'rejected'::public.payment_status ELSE OLD.payment_status END;
      NEW.payment_confirmed_by:=NULL; NEW.payment_confirmed_at:=NULL;
    ELSIF (OLD.status='diproses' AND NEW.status='siap') OR (OLD.status='siap' AND NEW.status='selesai') THEN
      NEW.payment_status:=OLD.payment_status; NEW.payment_confirmed_by:=OLD.payment_confirmed_by; NEW.payment_confirmed_at:=OLD.payment_confirmed_at;
    ELSE RAISE EXCEPTION 'Illegal order transition' USING ERRCODE='22023'; END IF;
  ELSE RAISE EXCEPTION 'Actor cannot perform this order transition' USING ERRCODE='42501';
  END IF;
  NEW.version:=OLD.version+1; NEW.updated_at:=now(); RETURN NEW;
END
$fn$;
CREATE TRIGGER orders_guard BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION app_private.order_guard();

CREATE FUNCTION app_private.link_checkout_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  INSERT INTO app_private.checkout_orders(order_id,tenant_id,idempotency_key)
    VALUES(NEW.id,NEW.tenant_id,app_private.ctx_uuid('kantin.checkout_id'));
  INSERT INTO app_private.order_payment_snapshots(order_id,tenant_id,qris_image_url,merchant_name)
    SELECT NEW.id,NEW.tenant_id,qris_image_url,qris_merchant_name FROM public.tenants WHERE id=NEW.tenant_id;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER orders_link BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION app_private.link_checkout_order();

CREATE FUNCTION app_private.item_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE product public.menus%ROWTYPE; amount bigint;
BEGIN
  PERFORM app_private.require_request_id();
  IF NOT app_private.valid_checkout() OR NOT app_private.checkout_order(NEW.order_id) THEN
    RAISE EXCEPTION 'Order items can only be created in their checkout transaction' USING ERRCODE='42501';
  END IF;
  SELECT * INTO product FROM public.menus WHERE id=NEW.menu_id FOR SHARE;
  IF NOT FOUND OR product.tenant_id<>NEW.tenant_id OR NOT product.is_active OR NOT product.is_available THEN
    RAISE EXCEPTION 'Menu unavailable or belongs to another tenant' USING ERRCODE='23514';
  END IF;
  IF NEW.qty NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Quantity out of range' USING ERRCODE='23514'; END IF;
  amount:=NEW.qty::bigint*product.price::bigint;
  IF amount>1000000000 THEN RAISE EXCEPTION 'Line amount exceeds limit' USING ERRCODE='23514'; END IF;
  NEW.unit_price:=product.price; NEW.menu_name:=product.name; NEW.subtotal:=amount::integer;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER items_snapshot BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION app_private.item_snapshot();

CREATE FUNCTION app_private.audit_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE previous jsonb; action_name text := 'created'; rejection text;
BEGIN
  IF TG_OP='UPDATE' THEN
    previous:=jsonb_build_object('status',OLD.status,'payment_status',OLD.payment_status,'version',OLD.version);
    action_name:=CASE WHEN NEW.status='menunggu_konfirmasi' THEN 'payment_reported'
      WHEN OLD.status='menunggu_konfirmasi' AND NEW.status='diproses' THEN 'payment_accepted'
      WHEN OLD.status='menunggu_konfirmasi' AND NEW.status='menunggu_bayar' THEN 'payment_rejected' ELSE 'status_changed' END;
    IF action_name='payment_rejected' THEN rejection:=btrim(current_setting('kantin.rejection_reason',true)); END IF;
  END IF;
  INSERT INTO app_private.order_events(order_id,tenant_id,actor_user_id,actor_kind,action,before_state,after_state,reason,request_id)
  VALUES(NEW.id,NEW.tenant_id,app_private.staff_id(),coalesce(app_private.ctx_kind(),'unknown'),action_name,previous,
    jsonb_build_object('status',NEW.status,'payment_status',NEW.payment_status,'version',NEW.version),
    rejection,app_private.require_request_id());
  RETURN NEW;
END
$fn$;
CREATE TRIGGER orders_audit AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION app_private.audit_order();

CREATE FUNCTION app_private.immutable_row() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN RAISE EXCEPTION 'Snapshot, audit, and order history cannot be edited or hard-deleted' USING ERRCODE='42501'; END
$fn$;
CREATE TRIGGER items_immutable BEFORE UPDATE OR DELETE ON public.order_items FOR EACH ROW EXECUTE FUNCTION app_private.immutable_row();
CREATE TRIGGER orders_no_delete BEFORE DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION app_private.immutable_row();
CREATE TRIGGER snapshots_immutable BEFORE UPDATE OR DELETE ON app_private.order_payment_snapshots FOR EACH ROW EXECUTE FUNCTION app_private.immutable_row();
CREATE TRIGGER order_events_immutable BEFORE UPDATE OR DELETE ON app_private.order_events FOR EACH ROW EXECUTE FUNCTION app_private.immutable_row();
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON app_private.audit_events FOR EACH ROW EXECUTE FUNCTION app_private.immutable_row();

CREATE FUNCTION app_private.grant_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  PERFORM app_private.require_request_id();
  IF (NEW.id,NEW.order_id,NEW.tenant_id,NEW.token_digest,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.order_id,OLD.tenant_id,OLD.token_digest,OLD.created_at) THEN
    RAISE EXCEPTION 'Capability identity and digest are immutable' USING ERRCODE='42501';
  END IF;
  NEW.updated_at:=now(); RETURN NEW;
END
$fn$;
CREATE TRIGGER grants_guard BEFORE UPDATE ON app_private.order_access_grants FOR EACH ROW EXECUTE FUNCTION app_private.grant_guard();

-- Deferred aggregate checks enforce atomic orders and complete checkout replay.
CREATE FUNCTION app_private.verify_order_total() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE target uuid; expected integer; actual bigint; lines bigint;
BEGIN
  IF TG_TABLE_NAME='orders' THEN target:=NEW.id; ELSE target:=NEW.order_id; END IF;
  SELECT total INTO expected FROM public.orders WHERE id=target FOR UPDATE;
  SELECT count(*),coalesce(sum(subtotal),0) INTO lines,actual FROM public.order_items WHERE order_id=target;
  IF lines NOT BETWEEN 1 AND 100 OR actual<>expected THEN
    RAISE EXCEPTION 'Order must contain 1..100 lines with an exact total' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END
$fn$;
CREATE CONSTRAINT TRIGGER orders_aggregate_check AFTER INSERT OR UPDATE ON public.orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.verify_order_total();
CREATE CONSTRAINT TRIGGER items_aggregate_check AFTER INSERT ON public.order_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.verify_order_total();

CREATE FUNCTION app_private.verify_checkout_complete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE done timestamptz; lines bigint;
BEGIN
  SELECT completed_at INTO done FROM app_private.checkout_requests WHERE idempotency_key=NEW.idempotency_key;
  SELECT count(*) INTO lines FROM app_private.checkout_orders WHERE idempotency_key=NEW.idempotency_key;
  IF done IS NULL OR lines NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Checkout must finish atomically with an encrypted replay and 1..100 orders' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM app_private.checkout_orders co LEFT JOIN app_private.order_access_grants g ON g.order_id=co.order_id
    WHERE co.idempotency_key=NEW.idempotency_key AND g.id IS NULL) THEN
    RAISE EXCEPTION 'Every checkout order needs a private access grant' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END
$fn$;
CREATE CONSTRAINT TRIGGER checkout_complete_check AFTER INSERT OR UPDATE ON app_private.checkout_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.verify_checkout_complete();

-- API grants are necessary but not sufficient: all row policies below are mandatory.
DO $rls$
DECLARE t record;
BEGIN
  FOR t IN SELECT schemaname,tablename FROM pg_tables
    WHERE schemaname='app_private' OR (schemaname='public' AND tablename IN ('outlets','tenants','menus','orders','order_items'))
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schemaname,t.tablename);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',t.schemaname,t.tablename);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC,anon,authenticated,service_role,authenticator',t.schemaname,t.tablename);
    EXECUTE format('GRANT SELECT ON TABLE %I.%I TO kantin_api',t.schemaname,t.tablename);
  END LOOP;
END
$rls$;
GRANT INSERT,UPDATE ON public.outlets,public.tenants,public.menus TO kantin_api;
GRANT INSERT ON public.orders,public.order_items TO kantin_api;
GRANT UPDATE(status,payment_status,payment_confirmed_by,payment_confirmed_at,version,updated_at) ON public.orders TO kantin_api;
GRANT INSERT,UPDATE ON app_private.users,app_private.checkout_requests,app_private.order_access_grants TO kantin_api;
GRANT SELECT ON public.orders TO order_tracker;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC,anon,authenticated,service_role,authenticator,order_tracker;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO kantin_api;
GRANT EXECUTE ON FUNCTION app_private.tracker_order(uuid) TO order_tracker;

CREATE POLICY outlets_read ON public.outlets FOR SELECT TO kantin_api
  USING (app_private.is_admin() OR (is_active AND app_private.catalog_context())
    OR EXISTS (SELECT 1 FROM public.tenants WHERE outlet_id=outlets.id AND id=app_private.staff_tenant_id()));
CREATE POLICY outlets_create ON public.outlets FOR INSERT TO kantin_api WITH CHECK (app_private.is_admin());
CREATE POLICY outlets_update ON public.outlets FOR UPDATE TO kantin_api USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

CREATE POLICY tenants_read ON public.tenants FOR SELECT TO kantin_api
  USING (app_private.manage_tenant(id) OR (app_private.catalog_context() AND app_private.active_tenant(id)));
CREATE POLICY tenants_create ON public.tenants FOR INSERT TO kantin_api WITH CHECK (app_private.is_admin());
CREATE POLICY tenants_update ON public.tenants FOR UPDATE TO kantin_api USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

CREATE POLICY menus_read ON public.menus FOR SELECT TO kantin_api
  USING (app_private.manage_tenant(tenant_id) OR (is_active AND app_private.catalog_context() AND app_private.active_tenant(tenant_id)));
CREATE POLICY menus_create ON public.menus FOR INSERT TO kantin_api WITH CHECK (app_private.manage_tenant(tenant_id));
CREATE POLICY menus_update ON public.menus FOR UPDATE TO kantin_api USING (app_private.manage_tenant(tenant_id)) WITH CHECK (app_private.manage_tenant(tenant_id));

CREATE POLICY users_read ON app_private.users FOR SELECT TO kantin_api USING (app_private.is_admin() OR id=app_private.staff_id());
CREATE POLICY users_create ON app_private.users FOR INSERT TO kantin_api WITH CHECK (app_private.is_admin());
CREATE POLICY users_update ON app_private.users FOR UPDATE TO kantin_api USING (app_private.is_admin()) WITH CHECK (app_private.is_admin());

CREATE POLICY checkout_read ON app_private.checkout_requests FOR SELECT TO kantin_api
  USING (app_private.ctx_kind()='checkout' AND idempotency_key=app_private.ctx_uuid('kantin.checkout_id')
    AND request_hash=current_setting('kantin.request_hash',true) AND expires_at>now());
CREATE POLICY checkout_create ON app_private.checkout_requests FOR INSERT TO kantin_api
  WITH CHECK (app_private.ctx_kind()='checkout' AND idempotency_key=app_private.ctx_uuid('kantin.checkout_id')
    AND request_hash=current_setting('kantin.request_hash',true) AND completed_at IS NULL);
CREATE POLICY checkout_update ON app_private.checkout_requests FOR UPDATE TO kantin_api
  USING (app_private.valid_checkout() AND idempotency_key=app_private.ctx_uuid('kantin.checkout_id'))
  WITH CHECK (app_private.ctx_kind()='checkout' AND idempotency_key=app_private.ctx_uuid('kantin.checkout_id')
    AND request_hash=current_setting('kantin.request_hash',true));
CREATE POLICY checkout_orders_read ON app_private.checkout_orders FOR SELECT TO kantin_api
  USING (app_private.checkout_order(order_id) OR app_private.manage_tenant(tenant_id));

CREATE POLICY orders_read ON public.orders FOR SELECT TO kantin_api
  USING (app_private.manage_tenant(tenant_id) OR app_private.customer_order(id) OR app_private.checkout_order(id));
CREATE POLICY orders_create ON public.orders FOR INSERT TO kantin_api
  WITH CHECK (app_private.valid_checkout() AND app_private.active_tenant(tenant_id));
CREATE POLICY orders_update ON public.orders FOR UPDATE TO kantin_api
  USING (app_private.manage_tenant(tenant_id) OR app_private.customer_order(id))
  WITH CHECK (app_private.manage_tenant(tenant_id) OR app_private.customer_order(id));
CREATE POLICY orders_tracker_read ON public.orders FOR SELECT TO order_tracker USING (app_private.tracker_order(id));

CREATE POLICY items_read ON public.order_items FOR SELECT TO kantin_api
  USING (app_private.manage_tenant(tenant_id) OR app_private.customer_order(order_id) OR app_private.checkout_order(order_id));
CREATE POLICY items_create ON public.order_items FOR INSERT TO kantin_api
  WITH CHECK (app_private.valid_checkout() AND app_private.checkout_order(order_id));
CREATE POLICY grants_read ON app_private.order_access_grants FOR SELECT TO kantin_api
  USING (app_private.manage_tenant(tenant_id) OR app_private.customer_order(order_id) OR app_private.checkout_order(order_id));
CREATE POLICY grants_create ON app_private.order_access_grants FOR INSERT TO kantin_api
  WITH CHECK (app_private.valid_checkout() AND app_private.checkout_order(order_id) AND revoked_at IS NULL);
CREATE POLICY grants_update ON app_private.order_access_grants FOR UPDATE TO kantin_api
  USING (app_private.manage_tenant(tenant_id)) WITH CHECK (app_private.manage_tenant(tenant_id));
CREATE POLICY snapshots_read ON app_private.order_payment_snapshots FOR SELECT TO kantin_api
  USING (app_private.manage_tenant(tenant_id) OR app_private.customer_order(order_id) OR app_private.checkout_order(order_id));
CREATE POLICY events_read ON app_private.order_events FOR SELECT TO kantin_api
  USING (app_private.manage_tenant(tenant_id) OR app_private.customer_order(order_id) OR app_private.checkout_order(order_id));
CREATE POLICY audit_read ON app_private.audit_events FOR SELECT TO kantin_api
  USING (app_private.is_admin() OR (tenant_id IS NOT NULL AND app_private.manage_tenant(tenant_id)));

CREATE FUNCTION app_private.purge_expired_checkouts() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE removed bigint;
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Admin maintenance context required' USING ERRCODE='42501'; END IF;
  PERFORM app_private.require_request_id();
  DELETE FROM app_private.checkout_requests WHERE expires_at<=now() AND completed_at IS NOT NULL;
  GET DIAGNOSTICS removed=ROW_COUNT;
  RETURN removed;
END
$fn$;
REVOKE ALL ON FUNCTION app_private.purge_expired_checkouts() FROM PUBLIC,anon,authenticated,service_role,authenticator,order_tracker;
GRANT EXECUTE ON FUNCTION app_private.purge_expired_checkouts() TO kantin_api;

-- Existing permissive Storage policies cannot override these restrictive denials.
-- Public menu delivery is supported by its public bucket, not by browser write grants.
DO $storage_check$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='storage' AND c.relname IN ('objects','buckets') AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Supabase Storage RLS is unexpectedly disabled; inspect managed Storage configuration';
  END IF;
END
$storage_check$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
  ('menu-photos','menu-photos',true,2097152,ARRAY['image/jpeg','image/png','image/webp']),
  ('tenant-qris','tenant-qris',false,2097152,ARRAY['image/jpeg','image/png','image/webp']),
  ('floor-maps','floor-maps',false,2097152,ARRAY['image/jpeg','image/png','image/webp']);
CREATE POLICY kantin_objects_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated,order_tracker
  USING (bucket_id NOT IN ('menu-photos','tenant-qris','floor-maps'))
  WITH CHECK (bucket_id NOT IN ('menu-photos','tenant-qris','floor-maps'));
CREATE POLICY kantin_buckets_server_only ON storage.buckets AS RESTRICTIVE FOR ALL TO anon,authenticated,order_tracker
  USING (id NOT IN ('menu-photos','tenant-qris','floor-maps'))
  WITH CHECK (id NOT IN ('menu-photos','tenant-qris','floor-maps'));

-- Do not modify publication settings for other applications in the project.
DO $realtime$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime WITH (publish='update');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime' AND puballtables)
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END
$realtime$;
COMMENT ON SCHEMA app_private IS 'Kantin v1: private profiles, capabilities, checkout replay and immutable audit. Never expose through Data API.';
COMMENT ON ROLE kantin_api IS 'Express/Prisma connection only. Set a password in the separate operator script. Never grant to authenticator.';
COMMENT ON ROLE order_tracker IS 'Read-only capability JWT for Realtime. Requires an accepted Supabase signing key and order_id/jti/purpose/iat/exp claims.';
-- Optional, idempotent placeholder data; never creates paid orders or Auth accounts.

SELECT set_config('kantin.actor_kind','maintenance',true);
SELECT set_config('kantin.request_id',gen_random_uuid()::text,true);
INSERT INTO public.outlets(id,name,location,is_active) VALUES
 ('10000000-0000-4000-8000-000000000001','Kantin Fakultas','Lokasi fakultas akan dilengkapi',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tenants(id,outlet_id,name,description,qris_image_url,qris_merchant_name,is_active) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  'Warung Bu Sari','Tenant placeholder pertama. Lengkapi QRIS sebelum diaktifkan.',NULL,NULL,false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menus(id,tenant_id,name,price,is_available) VALUES
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Nasi Ayam Geprek',18000,true),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Nasi Goreng Kampung',16000,true),
 ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','Mie Goreng Spesial',15000,true),
 ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','Ayam Crispy',14000,true),
 ('40000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','Es Teh Lemon',6000,true),
 ('40000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','Es Kopi Susu',12000,true),
 ('40000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000001','Pangsit Goreng',10000,true),
 ('40000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000001','Mie Kuah Hangat',14000,false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
