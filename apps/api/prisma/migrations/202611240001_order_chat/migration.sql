-- Apply after orders-upgrade.sql, as the database operator.
BEGIN;

CREATE TABLE app_private.order_messages (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  id uuid NOT NULL,
  sequence bigint GENERATED ALWAYS AS IDENTITY,
  sender varchar(10) NOT NULL CHECK (sender IN ('pelanggan', 'tenant')),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  text varchar(1000) NOT NULL CHECK (char_length(btrim(text, E' \t\n\r')) BETWEEN 1 AND 1000),
  created_at timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (order_id, id)
);
CREATE INDEX order_messages_history_idx ON app_private.order_messages(order_id, sequence DESC);
CREATE INDEX order_messages_rate_idx ON app_private.order_messages(order_id, sender, created_at DESC);

-- Use the existing order RLS as well as the narrower two-participant scope.
CREATE FUNCTION app_private.order_chat_role(target uuid) RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $fn$
  SELECT CASE
    WHEN app_private.ctx_kind() = 'customer_account' AND app_private.customer_order(o.id) THEN 'pelanggan'
    WHEN app_private.staff_tenant_id() = o.tenant_id
      AND app_private.auth_account_active(app_private.staff_id()) THEN 'tenant'
  END
  FROM public.orders o WHERE o.id = target AND o.customer_id IS NOT NULL;
$fn$;
REVOKE ALL ON FUNCTION app_private.order_chat_role(uuid) FROM PUBLIC, anon, authenticated, service_role, order_tracker;
GRANT EXECUTE ON FUNCTION app_private.order_chat_role(uuid) TO kantin_api;

CREATE FUNCTION app_private.guard_order_message() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE current_status public.order_status;
BEGIN
  IF app_private.order_chat_role(NEW.order_id) IS DISTINCT FROM NEW.sender THEN
    RAISE EXCEPTION 'Order conversation unavailable' USING ERRCODE = '42501';
  END IF;
  -- A send and a terminal status update must see a consistent order state.
  SELECT status INTO current_status FROM public.orders WHERE id = NEW.order_id FOR SHARE;
  IF current_status IS NULL OR current_status IN ('selesai', 'dibatalkan') THEN
    RAISE EXCEPTION 'Order conversation closed' USING ERRCODE = '23514';
  END IF;
  NEW.sender_id := app_private.ctx_uuid('kantin.actor_id');
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION app_private.guard_order_message() FROM PUBLIC, anon, authenticated, service_role, order_tracker;
CREATE TRIGGER order_messages_guard BEFORE INSERT ON app_private.order_messages
  FOR EACH ROW EXECUTE FUNCTION app_private.guard_order_message();

ALTER TABLE app_private.order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.order_messages FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.order_messages FROM PUBLIC, anon, authenticated, service_role, order_tracker;
REVOKE ALL ON SEQUENCE app_private.order_messages_sequence_seq FROM PUBLIC, anon, authenticated, service_role, order_tracker;
GRANT SELECT, INSERT (order_id, id, sender, sender_id, text) ON app_private.order_messages TO kantin_api;
GRANT USAGE ON SEQUENCE app_private.order_messages_sequence_seq TO kantin_api;
CREATE POLICY order_messages_read ON app_private.order_messages FOR SELECT TO kantin_api
  USING (app_private.order_chat_role(order_id) IS NOT NULL);
CREATE POLICY order_messages_insert ON app_private.order_messages FOR INSERT TO kantin_api
  WITH CHECK (app_private.order_chat_role(order_id) = sender
    AND app_private.ctx_uuid('kantin.actor_id') = sender_id);

COMMIT;
