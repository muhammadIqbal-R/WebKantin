-- Read-only verification after setup.sql. Safe to rerun.
BEGIN READ ONLY;
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='r' AND (n.nspname='app_private' OR (n.nspname='public' AND c.relname IN ('outlets','tenants','menus','orders','order_items')))
ORDER BY 1,2;
SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname IN ('kantin_api','order_tracker');
SELECT
  NOT pg_has_role('authenticator','kantin_api','MEMBER') AS browser_cannot_assume_api,
  NOT has_table_privilege('anon','public.orders','SELECT') AS anon_cannot_read_orders,
  NOT has_table_privilege('authenticated','public.orders','INSERT,UPDATE,DELETE,TRUNCATE') AS browser_cannot_mutate_orders,
  NOT has_table_privilege('order_tracker','public.orders','INSERT,UPDATE,DELETE,TRUNCATE') AS tracker_read_only,
  has_table_privilege('order_tracker','public.orders','SELECT') AS tracker_has_select,
  NOT has_schema_privilege('anon','app_private','USAGE') AS anonymous_private_schema_denied;
SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id IN ('menu-photos','tenant-qris','floor-maps') ORDER BY id;
SELECT pubname,schemaname,tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders';
SELECT (SELECT count(*) FROM public.outlets) AS outlets,(SELECT count(*) FROM public.tenants) AS tenants,
  (SELECT count(*) FROM public.menus) AS menus,(SELECT count(*) FROM app_private.users) AS staff_profiles;
SELECT id,name,is_active,qris_image_url IS NOT NULL AS qris_configured,qris_merchant_name IS NOT NULL AS merchant_configured FROM public.tenants ORDER BY created_at;
DO $verify$
DECLARE protected_count integer;
BEGIN
  SELECT count(*) INTO protected_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
    AND ((n.nspname='public' AND c.relname IN ('outlets','tenants','menus','orders','order_items'))
      OR (n.nspname='app_private' AND c.relname IN ('users','checkout_requests','checkout_orders','order_access_grants','order_payment_snapshots','order_events','audit_events')));
  IF protected_count<>12 THEN RAISE EXCEPTION 'Expected 12 protected application tables, found %',protected_count; END IF;
  IF pg_has_role('authenticator','kantin_api','MEMBER') THEN RAISE EXCEPTION 'API role must not be granted to authenticator'; END IF;
END
$verify$;
COMMIT;

