-- Append-only upgrade; run after the initial baseline. Does not seed/reset data.
BEGIN;
ALTER TABLE public.tenants ADD COLUMN archived_at timestamptz;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_archive_inactive CHECK (archived_at IS NULL OR NOT is_active);
ALTER TABLE public.menus
  ADD COLUMN stock integer NOT NULL DEFAULT 0 CHECK (stock BETWEEN 0 AND 1000000),
  ADD COLUMN stock_version integer NOT NULL DEFAULT 1 CHECK (stock_version > 0),
  ADD COLUMN category varchar(20) NOT NULL DEFAULT 'Makanan' CHECK (category IN ('Makanan','Minuman','Camilan')),
  ADD COLUMN description varchar(250) NOT NULL DEFAULT '';

-- Existing menus have no known inventory. Require operators to fill it explicitly.
SELECT set_config('kantin.actor_kind','maintenance',true), set_config('kantin.request_id',gen_random_uuid()::text,true);
UPDATE public.menus SET is_available=false WHERE is_available;
ALTER TABLE public.menus ADD CONSTRAINT menus_stock_available CHECK (stock>0 OR NOT is_available);

CREATE FUNCTION app_private.management_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF TG_TABLE_NAME='tenants' THEN
    IF NEW.archived_at IS NOT NULL THEN NEW.is_active:=false; END IF;
    IF TG_OP='UPDATE' AND OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN NEW.is_active:=false; END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id=NEW.tenant_id AND archived_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Archived tenant cannot change menus' USING ERRCODE='23514';
    END IF;
    IF TG_OP='UPDATE' THEN
      NEW.stock_version:=OLD.stock_version + CASE WHEN NEW.stock IS DISTINCT FROM OLD.stock THEN 1 ELSE 0 END;
    ELSE NEW.stock_version:=1; END IF;
    IF NEW.stock=0 THEN NEW.is_available:=false; END IF;
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION app_private.management_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER a_tenants_management BEFORE INSERT OR UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION app_private.management_guard();
CREATE TRIGGER a_menus_management BEFORE INSERT OR UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION app_private.management_guard();
COMMIT;
