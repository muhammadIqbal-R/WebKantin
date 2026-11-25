-- Apply after chat-upgrade.sql, as the database operator.
BEGIN;

CREATE TABLE app_private.order_payment_windows (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  deadline_at timestamptz NOT NULL,
  expired_at timestamptz CHECK (expired_at IS NULL OR expired_at >= deadline_at)
);
CREATE INDEX order_payment_windows_due_idx ON app_private.order_payment_windows(deadline_at, order_id)
  WHERE expired_at IS NULL;

CREATE TABLE app_private.order_refunds (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  source varchar(14) NOT NULL DEFAULT 'paid' CHECK (source IN ('paid', 'expired_claim')),
  amount integer NOT NULL DEFAULT 0 CHECK (amount BETWEEN 1 AND 1000000000),
  reason varchar(300) NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 2 AND 300),
  status varchar(16) NOT NULL DEFAULT 'diminta' CHECK (status IN ('diminta','diproses','ditolak','dikembalikan')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  processor_id uuid REFERENCES app_private.users(id) ON DELETE RESTRICT,
  taken_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES app_private.users(id) ON DELETE RESTRICT,
  resolution_note varchar(300),
  transfer_ref varchar(100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_private.order_chat_receipts (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  reader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_sequence bigint NOT NULL CHECK (last_read_sequence > 0),
  PRIMARY KEY(order_id, reader_id)
);

ALTER TABLE app_private.order_payment_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.order_payment_windows FORCE ROW LEVEL SECURITY;
ALTER TABLE app_private.order_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.order_refunds FORCE ROW LEVEL SECURITY;
ALTER TABLE app_private.order_chat_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.order_chat_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.order_payment_windows, app_private.order_refunds, app_private.order_chat_receipts
  FROM PUBLIC, anon, authenticated, service_role, order_tracker;
GRANT SELECT ON app_private.order_payment_windows, app_private.order_refunds, app_private.order_chat_receipts TO kantin_api;
GRANT INSERT (order_id,reason), UPDATE (status,resolution_note,transfer_ref) ON app_private.order_refunds TO kantin_api;
GRANT INSERT, UPDATE (last_read_sequence) ON app_private.order_chat_receipts TO kantin_api;
CREATE POLICY payment_window_read ON app_private.order_payment_windows FOR SELECT TO kantin_api
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id
    AND ((app_private.ctx_kind()='customer_account' AND app_private.customer_order(o.id))
      OR (app_private.manage_tenant(o.tenant_id) AND app_private.auth_account_active(app_private.staff_id())))));
CREATE POLICY refund_read ON app_private.order_refunds FOR SELECT TO kantin_api
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id
    AND ((app_private.ctx_kind()='customer_account' AND app_private.customer_order(o.id))
      OR (app_private.manage_tenant(o.tenant_id) AND app_private.auth_account_active(app_private.staff_id())))));
CREATE POLICY refund_request ON app_private.order_refunds FOR INSERT TO kantin_api
  WITH CHECK (app_private.ctx_kind()='customer_account' AND app_private.customer_order(order_id));
CREATE POLICY refund_decide ON app_private.order_refunds FOR UPDATE TO kantin_api
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND app_private.manage_tenant(o.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND app_private.manage_tenant(o.tenant_id)));
CREATE POLICY chat_receipts_actor ON app_private.order_chat_receipts FOR ALL TO kantin_api
  USING (reader_id=app_private.ctx_uuid('kantin.actor_id') AND app_private.order_chat_role(order_id) IS NOT NULL)
  WITH CHECK (reader_id=app_private.ctx_uuid('kantin.actor_id') AND app_private.order_chat_role(order_id) IS NOT NULL);

CREATE FUNCTION app_private.init_order_payment_window() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE ttl integer := nullif(current_setting('kantin.unpaid_ttl_minutes',true),'')::integer;
BEGIN
  -- Older instances may still accept orders between migration and deployment.
  IF NEW.customer_id IS NOT NULL AND ttl IS NOT NULL THEN
    INSERT INTO app_private.order_payment_windows(order_id,deadline_at)
      VALUES(NEW.id,NEW.created_at + make_interval(mins=>greatest(5,least(120,ttl))));
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER orders_init_payment_window AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION app_private.init_order_payment_window();

CREATE FUNCTION app_private.guard_order_operations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF OLD.status='menunggu_bayar' AND OLD.payment_status='unpaid' AND NEW.status='menunggu_konfirmasi'
    AND EXISTS (SELECT 1 FROM app_private.order_payment_windows WHERE order_id=OLD.id AND deadline_at<=clock_timestamp()) THEN
    RAISE EXCEPTION 'Payment claim deadline passed' USING ERRCODE='23514';
  END IF;
  IF NEW.status IN ('siap','selesai') AND EXISTS (
    SELECT 1 FROM app_private.order_refunds WHERE order_id=OLD.id AND status IN ('diproses','dikembalikan')
  ) THEN
    RAISE EXCEPTION 'Fulfillment is locked by the refund' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER a_orders_operations_guard BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_order_operations();

CREATE FUNCTION app_private.guard_refund() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE sale public.orders%ROWTYPE; actor uuid := app_private.staff_id();
BEGIN
  PERFORM app_private.require_request_id();
  SELECT * INTO sale FROM public.orders WHERE id=NEW.order_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order missing' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF app_private.ctx_kind() IS DISTINCT FROM 'customer_account' OR NOT app_private.customer_order(sale.id) THEN
      RAISE EXCEPTION 'Refund requires the customer' USING ERRCODE='42501';
    END IF;
    IF sale.payment_status='paid' THEN
      NEW.source:='paid';
    ELSIF sale.status='dibatalkan' AND EXISTS (
      SELECT 1 FROM app_private.order_payment_windows WHERE order_id=sale.id AND expired_at IS NOT NULL
    ) THEN
      NEW.source:='expired_claim';
    ELSE
      RAISE EXCEPTION 'Refund not available for order' USING ERRCODE='23514';
    END IF;
    NEW.amount:=sale.total;
    RETURN NEW;
  END IF;
  IF actor IS NULL OR NOT app_private.auth_account_active(actor) OR NOT app_private.manage_tenant(sale.tenant_id) THEN
    RAISE EXCEPTION 'Refund requires active staff' USING ERRCODE='42501';
  END IF;
  IF (NEW.order_id,NEW.source,NEW.amount,NEW.reason,NEW.created_at,NEW.version,NEW.processor_id,NEW.taken_at,NEW.resolved_at,NEW.resolved_by)
    IS DISTINCT FROM (OLD.order_id,OLD.source,OLD.amount,OLD.reason,OLD.created_at,OLD.version,OLD.processor_id,OLD.taken_at,OLD.resolved_at,OLD.resolved_by) THEN
    RAISE EXCEPTION 'Refund fields are server-owned' USING ERRCODE='23514';
  END IF;
  IF OLD.status='diminta' AND NEW.status='diproses' THEN
    NEW.processor_id:=actor;
    NEW.taken_at:=clock_timestamp();
    NEW.resolution_note:=NULL;
    NEW.transfer_ref:=NULL;
  ELSIF OLD.status='diminta' AND NEW.status='ditolak' AND char_length(btrim(coalesce(NEW.resolution_note,'')))>=2 THEN
    NEW.resolved_at:=clock_timestamp();
    NEW.resolved_by:=actor;
    NEW.transfer_ref:=NULL;
  ELSIF OLD.status='diproses' AND NEW.status='dikembalikan' AND actor=OLD.processor_id
    AND char_length(btrim(coalesce(NEW.transfer_ref,'')))>=2 THEN
    NEW.resolved_at:=clock_timestamp();
    NEW.resolved_by:=actor;
    NEW.resolution_note:=NULL;
  ELSE
    RAISE EXCEPTION 'Refund action unavailable' USING ERRCODE='23514';
  END IF;
  NEW.version:=OLD.version+1;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER order_refunds_guard BEFORE INSERT OR UPDATE ON app_private.order_refunds
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_refund();

CREATE OR REPLACE FUNCTION app_private.order_guard() RETURNS trigger
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
  ELSIF app_private.ctx_kind()='expiry' AND OLD.status='menunggu_bayar' AND OLD.payment_status='unpaid'
    AND NEW.status='dibatalkan' AND EXISTS (
      SELECT 1 FROM app_private.order_payment_windows WHERE order_id=OLD.id AND expired_at IS NOT NULL
    ) THEN
    NEW.payment_status:='unpaid'; NEW.payment_confirmed_by:=NULL; NEW.payment_confirmed_at:=NULL;
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
-- The worker can only close expired, never-claimed orders. The order guard, audit
-- and existing stock-restore trigger still govern every status transition.
CREATE FUNCTION app_private.expire_unpaid_orders() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE sale record; affected integer:=0;
BEGIN
  PERFORM set_config('kantin.actor_kind','expiry',true);
  PERFORM set_config('kantin.actor_id','',true);
  PERFORM set_config('kantin.request_id',gen_random_uuid()::text,true);
  FOR sale IN
    SELECT o.id,o.version FROM app_private.order_payment_windows w JOIN public.orders o ON o.id=w.order_id
    WHERE w.expired_at IS NULL AND w.deadline_at<=clock_timestamp() AND o.status='menunggu_bayar' AND o.payment_status='unpaid'
    ORDER BY w.deadline_at,w.order_id LIMIT 20 FOR UPDATE OF o SKIP LOCKED
  LOOP
    PERFORM set_config('kantin.expected_version',sale.version::text,true);
    UPDATE app_private.order_payment_windows SET expired_at=clock_timestamp() WHERE order_id=sale.id;
    UPDATE public.orders SET status='dibatalkan' WHERE id=sale.id;
    affected:=affected+1;
  END LOOP;
  PERFORM set_config('kantin.actor_kind','',true);
  PERFORM set_config('kantin.expected_version','',true);
  RETURN affected;
END
$fn$;
REVOKE ALL ON FUNCTION app_private.init_order_payment_window(),app_private.guard_order_operations(),app_private.guard_refund(),
  app_private.expire_unpaid_orders() FROM PUBLIC, anon, authenticated, service_role, order_tracker, kantin_api;
GRANT EXECUTE ON FUNCTION app_private.expire_unpaid_orders() TO kantin_api;

COMMIT;
