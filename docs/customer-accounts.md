# Akun pelanggan minimal · perubahan kebutuhan

**Status:** draft · 2026-11-12 · terkait F-02, F-04, F-09.
Instruksi terbaru pengguna mengganti non-goal awal “pemesan tanpa login”.

Pelanggan melihat katalog tanpa login; checkout memerlukan session Supabase Auth.
Pendaftaran minimal: nama tampilan 2–100 karakter, email, password minimal 8 karakter.
Tidak ada no. telepon wajib, poin, social login, atau SMS OTP pada tahap ini.
Email confirmation mengikuti konfigurasi project; jangan menyatakan berhasil login
ketika signUp belum menghasilkan session. Nama metadata hanya display, bukan role.

Frontend menggunakan Supabase JS hanya untuk Auth session. Form daftar/masuk,
pemulihan session, logout dan guard checkout dibuat pada web-user. Error login generik;
password tidak disimpan pada state demo, telemetry atau database aplikasi.
Tidak membuat profil admin/tenant dari pendaftaran pelanggan. Tabel users dan enum
app_role baseline tetap khusus staf; akun Auth publik tidak otomatis mendapat akses staf.

Kontrak shared: CustomerSignInSchema, CustomerSignUpSchema. Implementasi auth SDK
bukan handler API; mutation bisnis tetap Express-only. API checkout selanjutnya
harus memverifikasi Bearer JWT pelanggan dan mengikat order pada sub terverifikasi.
Guard frontend bukan otorisasi server.

Database baseline yang mungkin sudah dipasang pengguna tidak diubah/reinstall.
Perlu migration tambahan profil/customer-order ownership dan RLS sebelum checkout
operasional serta riwayat akun. Order capability lama tetap mekanisme pendukung
sementara; identitas pemesan tidak lagi dianggap anonymous. Realtime tetap memerlukan
spike dan pemetaan authorization akun, tidak membuka SELECT public orders.

Supabase operator: aktifkan Email provider dan public sign-up pelanggan; aktifkan
email confirmation dan tetapkan redirect allowlist origin web-user. Ini mengganti
instruksi lama “disable public signup”. Akun staf hanya melalui provisioning admin.
Frontend implementasi Auth dapat diuji operator; agen tidak mendaftarkan akun
atau mengirim email nyata saat QA.

Kriteria: anonymous lihat menu; checkout anonymous diarahkan form masuk; return path
dibatasi /checkout atau /; daftar memvalidasi konfirmasi password dan nama; login tidak
menampilkan error provider mentah; signup tanpa session meminta cek email; logout
membersihkan keranjang/order demo agar tidak terbawa akun berikutnya.
