-- Apply after order-operations-upgrade.sql, as the database operator.
BEGIN;

CREATE TABLE app_private.order_fulfillment_details (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  table_number varchar(16) CHECK (table_number IS NULL OR table_number ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$'),
  pickup_note varchar(200) CHECK (pickup_note IS NULL OR char_length(btrim(pickup_note, E' \t\r\n')) BETWEEN 1 AND 200),
  CHECK (table_number IS NOT NULL OR pickup_note IS NOT NULL)
);
ALTER TABLE app_private.order_fulfillment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.order_fulfillment_details FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.order_fulfillment_details FROM PUBLIC, anon, authenticated, service_role, order_tracker;
GRANT SELECT, INSERT ON app_private.order_fulfillment_details TO kantin_api;
CREATE POLICY order_fulfillment_read ON app_private.order_fulfillment_details FOR SELECT TO kantin_api
  USING (
    (app_private.valid_checkout() AND app_private.checkout_order(order_id))
    OR (app_private.ctx_kind()='customer_account' AND app_private.customer_order(order_id))
    OR (app_private.auth_account_active(app_private.staff_id()) AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id=order_id AND app_private.manage_tenant(o.tenant_id)
    ))
  );
CREATE POLICY order_fulfillment_create ON app_private.order_fulfillment_details FOR INSERT TO kantin_api
  WITH CHECK (
    app_private.valid_checkout() AND app_private.checkout_order(order_id)
    AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id=order_id
        AND (table_number IS NULL OR o.order_type='dine_in')
    )
  );

COMMIT;
