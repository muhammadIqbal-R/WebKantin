-- Optional, idempotent placeholder data; never creates paid orders or Auth accounts.
BEGIN;
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

