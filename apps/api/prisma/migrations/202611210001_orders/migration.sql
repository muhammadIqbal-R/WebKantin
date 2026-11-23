-- Apply after management upgrade, as operator. Existing anonymous history remains unowned.
BEGIN;
ALTER TABLE public.orders ADD COLUMN customer_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE app_private.checkout_requests ADD COLUMN customer_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
CREATE INDEX orders_customer_created_idx ON public.orders(customer_id,created_at,id);
CREATE INDEX orders_tenant_updated_idx ON public.orders(tenant_id,updated_at,id);
CREATE FUNCTION app_private.auth_account_active(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=target AND (banned_until IS NULL OR banned_until<=now()));
$f$;
REVOKE ALL ON FUNCTION app_private.auth_account_active(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.auth_account_active(uuid) TO kantin_api;

CREATE OR REPLACE FUNCTION app_private.customer_order(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT coalesce(
 (app_private.ctx_kind()='customer_account' AND app_private.auth_account_active(app_private.ctx_uuid('kantin.actor_id')) AND EXISTS(SELECT 1 FROM public.orders WHERE id=target AND customer_id=app_private.ctx_uuid('kantin.actor_id')))
 OR (app_private.ctx_kind()='customer' AND target=app_private.ctx_uuid('kantin.order_id') AND EXISTS(SELECT 1 FROM app_private.order_access_grants WHERE id=app_private.ctx_uuid('kantin.grant_id') AND order_id=target AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()))),false);
$f$;
CREATE FUNCTION app_private.checkout_owner_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.customer_id:=app_private.ctx_uuid('kantin.customer_id');
  IF NOT app_private.auth_account_active(NEW.customer_id) THEN RAISE EXCEPTION 'Active customer required' USING ERRCODE='42501'; END IF;
 ELSIF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN RAISE EXCEPTION 'Checkout owner immutable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER a_checkout_owner BEFORE INSERT OR UPDATE ON app_private.checkout_requests FOR EACH ROW EXECUTE FUNCTION app_private.checkout_owner_guard();
CREATE FUNCTION app_private.order_owner_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.customer_id:=app_private.ctx_uuid('kantin.customer_id');
  IF NOT app_private.auth_account_active(NEW.customer_id) OR NOT EXISTS(SELECT 1 FROM app_private.checkout_requests WHERE idempotency_key=app_private.ctx_uuid('kantin.checkout_id') AND customer_id=NEW.customer_id) THEN RAISE EXCEPTION 'Order owner required' USING ERRCODE='42501'; END IF;
 ELSIF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN RAISE EXCEPTION 'Order owner immutable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER a_orders_owner BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION app_private.order_owner_guard();

CREATE OR REPLACE FUNCTION app_private.management_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $f$
BEGIN
 IF TG_TABLE_NAME='tenants' THEN
  IF NEW.archived_at IS NOT NULL THEN NEW.is_active:=false; END IF;
  IF TG_OP='UPDATE' AND OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN NEW.is_active:=false; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.tenants WHERE id=NEW.tenant_id AND archived_at IS NOT NULL) THEN
   IF pg_trigger_depth()<=1 THEN RAISE EXCEPTION 'Archived tenant cannot change menus' USING ERRCODE='23514'; END IF;
   NEW.is_available:=false;
  END IF;
  IF TG_OP='UPDATE' THEN NEW.stock_version:=OLD.stock_version+CASE WHEN NEW.stock IS DISTINCT FROM OLD.stock THEN 1 ELSE 0 END; ELSE NEW.stock_version:=1; END IF;
  IF NEW.stock=0 THEN NEW.is_available:=false; END IF;
 END IF;
 RETURN NEW;
END $f$;
CREATE OR REPLACE FUNCTION app_private.item_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE product public.menus%ROWTYPE; amount bigint;
BEGIN
  PERFORM app_private.require_request_id();
  IF NOT app_private.valid_checkout() OR NOT app_private.checkout_order(NEW.order_id) THEN
    RAISE EXCEPTION 'Order items can only be created in their checkout transaction' USING ERRCODE='42501';
  END IF;
  SELECT * INTO product FROM public.menus WHERE id=NEW.menu_id FOR UPDATE;
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
CREATE FUNCTION app_private.reserve_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 UPDATE public.menus SET stock=stock-NEW.qty WHERE id=NEW.menu_id AND tenant_id=NEW.tenant_id AND stock>=NEW.qty AND is_active AND is_available;
 IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER items_reserve_stock AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION app_private.reserve_stock();
CREATE FUNCTION app_private.restore_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE line record;
BEGIN
 IF NEW.status='dibatalkan' AND OLD.status<>'dibatalkan' THEN
  FOR line IN SELECT menu_id,qty FROM public.order_items WHERE order_id=NEW.id ORDER BY menu_id LOOP
   UPDATE public.menus SET stock=stock+line.qty,is_available=CASE WHEN stock=0 AND is_active THEN true ELSE is_available END WHERE id=line.menu_id;
  END LOOP;
 END IF;
 RETURN NEW;
END $f$;
CREATE TRIGGER orders_restore_stock AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION app_private.restore_stock();
REVOKE ALL ON FUNCTION app_private.checkout_owner_guard(),app_private.order_owner_guard(),app_private.reserve_stock(),app_private.restore_stock() FROM PUBLIC,anon,authenticated,service_role,kantin_api;

CREATE FUNCTION app_private.auth_order_read(target uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE c jsonb:=app_private.claims(); actor uuid:=app_private.uuid_or_null(c->>'sub');
BEGIN
 IF c->>'role' IS DISTINCT FROM 'authenticated' OR NOT coalesce(c->'aud' @> '"authenticated"'::jsonb,false) OR coalesce((c->>'exp')::bigint,0)<=extract(epoch FROM now()) OR NOT app_private.auth_account_active(actor) THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM public.orders o WHERE o.id=target AND (o.customer_id=actor OR EXISTS(SELECT 1 FROM app_private.users u WHERE u.id=actor AND u.is_active AND (u.role='admin_pengelola' OR u.tenant_id=o.tenant_id))));
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $f$;
REVOKE ALL ON FUNCTION app_private.auth_order_read(uuid) FROM PUBLIC,anon,service_role,kantin_api;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.auth_order_read(uuid) TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
CREATE POLICY orders_account_read ON public.orders FOR SELECT TO authenticated USING(app_private.auth_order_read(id));
CREATE POLICY orders_account_scope ON public.orders AS RESTRICTIVE FOR SELECT TO authenticated USING(app_private.auth_order_read(id));

DO $publication$
DECLARE p record; modes text;
BEGIN
 SELECT * INTO p FROM pg_publication WHERE pubname='supabase_realtime';
 IF FOUND AND (NOT p.pubinsert OR NOT p.pubupdate) THEN
  modes:='insert,update'||CASE WHEN p.pubdelete THEN ',delete' ELSE '' END||CASE WHEN p.pubtruncate THEN ',truncate' ELSE '' END;
  EXECUTE format('ALTER PUBLICATION supabase_realtime SET (publish=%L)',modes);
 END IF;
END $publication$;
COMMIT;
