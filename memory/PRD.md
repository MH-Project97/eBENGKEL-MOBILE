# PRD — Aplikasi Manajemen Bengkel

## Problem Statement
Pengguna meminta aplikasi manajemen bengkel mobile dengan fitur utama:
- Login / registrasi dengan username, nama, password, email opsional
- Setelah login masuk ke dashboard
- Menu utama: kasir, bon/pencatatan transaksi, daftar barang, detail bengkel, detail pengguna
- Kasir harus mencakup barang, jasa, diskon, metode bayar, dan bon sederhana
- Pencatatan transaksi harus menyimpan tanggal, pelanggan, item, total, status, invoice, catatan, dan mekanik
- Daftar barang harus memiliki nama, kategori, harga, stok, supplier, kode barang, dan peringatan stok menipis
- Role pengguna: admin, kasir, mekanik

## Arsitektur
- Frontend: Expo Router + React Native + TypeScript
- Backend: FastAPI + MongoDB (Motor)
- Auth: login/register berbasis JWT sederhana
- Penyimpanan sesi: AsyncStorage
- Navigasi: auth screens + tab dashboard/kasir/transaksi/barang + stack detail bengkel/pengguna

## User Personas
- **Admin Bengkel**: mengelola pengguna, detail bengkel, stok, melihat dashboard lengkap
- **Kasir**: membuat transaksi, mengelola daftar barang, melihat riwayat transaksi
- **Mekanik**: melihat informasi dasar dan riwayat yang relevan, tanpa membuat transaksi

## Core Requirements (Static)
1. Aplikasi mobile-only dengan alur operasional bengkel harian
2. Login dan registrasi wajib berjalan end-to-end
3. Dashboard harus menampilkan ringkasan operasional
4. Kasir harus bisa membuat transaksi barang + jasa
5. Sistem stok harus tersinkron dengan transaksi
6. Data bengkel dan pengguna harus dapat dikelola

## Yang Sudah Diimplementasikan

### 2026-04-22
- Backend FastAPI lengkap untuk:
  - login, register, profil user aktif
  - manajemen pengguna dan role
  - profil/detail bengkel
  - CRUD barang dasar (buat, ubah, cari, list)
  - transaksi kasir dengan barang + jasa + diskon + metode bayar + status
  - ringkasan dashboard
- Pengembangan lanjutan fitur operasional:
  - filter transaksi berdasarkan tanggal manual, quick range, status, dan nama mekanik
  - edit transaksi dari riwayat transaksi ke mode edit di kasir
  - hapus transaksi khusus admin dengan konfirmasi ketik `HAPUS`
  - stok barang otomatis direkonsiliasi saat transaksi diubah atau dihapus
  - edit pengguna lengkap (username, nama, email, role, password opsional)
  - hapus pengguna khusus admin dengan konfirmasi ketik `HAPUS`
  - hapus barang khusus admin dengan konfirmasi ketik `HAPUS`
  - input jumlah pembayaran pada kasir dan edit transaksi
  - status pembayaran otomatis: `hutang`, `lunas`, `kembalian`
  - detail transaksi menyimpan `amount_paid`, `balance_due`, dan `change_due`
  - menu transaksi menampilkan ringkasan per pelanggan
  - saat ringkasan pelanggan dipilih, tampil seluruh rincian transaksi pelanggan termasuk item/jasa dan hutang aktif
  - perbaikan UX halaman transaksi: rincian pelanggan kini terbuka inline di kartu yang dipilih
  - header transaksi diringkas menjadi kolom pencarian + ikon cari + ikon filter + ikon muat ulang
  - filter transaksi dipindahkan ke modal/popup agar tampilan mobile lebih ringkas
  - navigasi footer diubah menjadi 5 tab dengan tab tengah `Menu`
  - menu tambahan dipindahkan dari dashboard ke tab `Menu`
  - tab `Menu` kini memuat Detail Pengguna, Detail Bengkel, Pengaturan, Tentang, Backup Data, dan ruang fitur mendatang
  - dashboard disederhanakan agar fokus pada ringkasan transaksi, omzet hari ini, status stok berkurang, dan transaksi terbaru
  - backup data JSON tersedia untuk admin melalui endpoint dan layar khusus
- Seed akun default otomatis saat database kosong:
  - admin / admin123
  - kasir / kasir123
  - mekanik / mekanik123
- Frontend Expo mobile dengan desain Swiss high-contrast:
  - layar login dan register
  - dashboard dengan statistik dan kartu menu
  - layar kasir dengan keranjang, jasa manual, total, dan bon HTML sederhana
  - layar bon/transaksi
  - layar daftar barang
  - layar detail bengkel
  - layar detail pengguna
- Font dan visual mengikuti panduan desain: Chivo + IBM Plex Sans, border tegas, tap targets besar, layout lapang
- Ilustrasi hero berbasis base64 untuk kompatibilitas Expo preview
- Kredensial demo ditulis ke `/app/memory/test_credentials.md`
- Pengujian:
  - curl backend untuk health, login, item, transaksi, dashboard
  - screenshot login → dashboard
  - verifikasi link login → register pada viewport kecil
  - regression test backend dari testing agent: 13/13 lulus pada iterasi terbaru
  - verifikasi UI filter transaksi, mode edit transaksi, pilih barang inventori, dan hapus barang via preview
  - regression test backend + frontend untuk pembayaran/hutang/ringkasan pelanggan: 18/18 pytest lulus dan UI transaksi pelanggan lulus
  - regression test frontend khusus redesign halaman transaksi lulus untuk toolbar baru, modal filter, dan detail inline pelanggan
  - regression test backend untuk dashboard + backup data lulus, serta verifikasi frontend untuk 5 tab dan tab Menu berhasil

## Backlog Prioritas

### P0
- Tambah validasi role/izin yang lebih granular per halaman
- Tambah filter dan pencarian lebih lengkap di transaksi
- Tambah edit/hapus untuk detail bengkel bila dibutuhkan admin

### P1
- Export bon PDF/native share yang lebih kaya
- Ringkasan omzet per hari/minggu/bulan
- Notifikasi stok minimum dan badge jumlah stok kritis
- Ringkasan pelanggan dengan filter pelanggan/invoice yang lebih cepat

### P2
- Multi-bengkel / multi-cabang
- Riwayat audit aktivitas pengguna
- Laporan servis per mekanik dan performa tim

## Next Tasks
- Rapikan analytics dashboard per periode
- Tambahkan edit/hapus untuk detail bengkel bila diperlukan
- Tambahkan laporan omzet mingguan/bulanan dan ringkasan mekanik