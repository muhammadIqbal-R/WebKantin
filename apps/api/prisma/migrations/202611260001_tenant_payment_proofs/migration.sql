-- Apply after order-fulfillment-upgrade.sql, as the database operator.
BEGIN;

CREATE TABLE app_private.order_payment_proofs (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  claim_version integer NOT NULL CHECK (claim_version >= 2),
  object_path text NOT NULL UNIQUE CHECK (
    object_path ~ ('^' || order_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
  ),
  PRIMARY KEY (order_id, claim_version)
);
ALTER TABLE app_private.order_payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.order_payment_proofs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.order_payment_proofs FROM PUBLIC, anon, authenticated, service_role, order_tracker;
GRANT SELECT, INSERT ON app_private.order_payment_proofs TO kantin_api;

CREATE POLICY order_payment_proofs_read ON app_private.order_payment_proofs FOR SELECT TO kantin_api
  USING (
    app_private.customer_order(order_id)
    OR (app_private.auth_account_active(app_private.staff_id()) AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.tenant_id=app_private.staff_tenant_id()
    ))
  );
CREATE POLICY order_payment_proofs_create ON app_private.order_payment_proofs FOR INSERT TO kantin_api
  WITH CHECK (
    app_private.ctx_kind()='customer_account' AND app_private.customer_order(order_id)
    AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.status='menunggu_bayar'
        AND claim_version=o.version+1
    )
  );

CREATE FUNCTION app_private.guard_tenant_payment_proof() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF app_private.ctx_kind()='staff' AND NEW.status<>OLD.status
    AND NOT coalesce(app_private.staff_tenant_id()=OLD.tenant_id
      AND app_private.auth_account_active(app_private.staff_id()), false) THEN
    RAISE EXCEPTION 'Only the active order tenant can change order status' USING ERRCODE='42501';
  END IF;
  IF OLD.status='menunggu_bayar' AND NEW.status='menunggu_konfirmasi' AND NOT EXISTS (
    SELECT 1 FROM app_private.order_payment_proofs
    WHERE order_id=OLD.id AND claim_version=OLD.version+1
  ) THEN
    RAISE EXCEPTION 'Payment proof required for this claim' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION app_private.guard_tenant_payment_proof()
  FROM PUBLIC, anon, authenticated, service_role, order_tracker, kantin_api;
CREATE TRIGGER orders_payment_proof_guard BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_tenant_payment_proof();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('payment-proofs','payment-proofs',false,2097152,ARRAY['image/webp']);
CREATE POLICY kantin_payment_proof_objects_server_only ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon,authenticated,order_tracker
  USING (bucket_id<>'payment-proofs') WITH CHECK (bucket_id<>'payment-proofs');
CREATE POLICY kantin_payment_proof_bucket_server_only ON storage.buckets AS RESTRICTIVE
  FOR ALL TO anon,authenticated,order_tracker
  USING (id<>'payment-proofs') WITH CHECK (id<>'payment-proofs');

COMMIT;
