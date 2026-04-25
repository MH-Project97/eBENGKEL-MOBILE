# PRD — Aplikasi Manajemen Bengkel

## Problem Statement
Pengguna meminta aplikasi manajemen bengkel mobile dengan fitur utama:
- Login / registrasi dengan username, nama, password, email opsional
- Setelah login masuk ke dashboard
- Menu utama: kasir, bon/pencatatan transaksi, daftar barang, detail bengkel, detail pengguna
- Kasir harus mencakup barang, jasa, diskon, metode bayar, dan bon sederhana
- Pencatatan transaksi harus menyimpan tanggal, pelanggan, item, total, status, invoice, catatan, dan mekanik
- Daftar barang harus memiliki nama, kategori, harga, stok, supplier, kode barang, dan peringatan stok menipis
- Role pengguna: owner, admin, kasir, mekanik
- Aplikasi kini harus mendukung **multi-bengkel / multi-user**:
  - owner mendaftar sambil membuat bengkel pertama
  - user/karyawan mendaftar sendiri lalu join via ID bengkel 18 karakter
  - data transaksi, barang, dashboard, dan anggota harus terisolasi penuh per bengkel
  - owner/admin dapat menyetujui atau menghapus akses karyawan dari halaman bengkel

## Arsitektur
- Frontend: Expo Router + React Native + TypeScript
- Backend: FastAPI + MongoDB (Motor)
- Auth: JWT access token + refresh cookie httpOnly, lockout login, switch bengkel aktif
- Penyimpanan sesi: AsyncStorage (mobile) + cookie auth backend untuk hardening browser flow
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
- Fondasi multi-bengkel dan multi-user selesai:
  - owner register sambil membuat bengkel pertama
  - user/karyawan register via ID bengkel 18 karakter
  - persetujuan akses karyawan oleh owner/admin dari halaman Detail Bengkel
  - owner dapat membuat bengkel baru dan berpindah bengkel aktif
  - seluruh data dashboard, barang, transaksi, pengguna, dan backup kini terisolasi per bengkel
  - auth diperkeras dengan cookie httpOnly, refresh endpoint, login-attempt lockout, dan seed owner opsional berbasis env
- UI utama dirapikan ulang ke arah modern-minimal:
  - card gambar/hero di login dan dashboard dihapus
  - header dashboard kini menampilkan nama bengkel aktif, nama user, dan role
  - kartu ringkasan "Workshop aktif / ID Bengkel / Akses Bengkel" di dashboard dihapus agar tampilan lebih ringkas
  - tombol keluar dipindah ke tab Menu bagian Sistem
  - halaman Detail Bengkel menampilkan ID bengkel, switch bengkel, form profil, approval karyawan, dan tambah bengkel baru
  - halaman Detail Pengguna kini fokus pada anggota aktif bengkel + ubah role/hapus akses
- Halaman Kasir dirombak mengikuti ilustrasi baru:
  - mode pelanggan `Konsumen/Bengkel` aktif dan memengaruhi harga barang (`consumer_price` vs `workshop_price`)
  - pelanggan kini dipilih lewat tombol + popup pencarian dari data bengkel; jika belum ada, pelanggan baru bisa langsung ditambahkan ke data bengkel dan otomatis terpilih
  - mekanik dipindahkan ke bagian Data Transaksi dan dipilih lewat popup dari data bengkel (gabungan user role mekanik + daftar mekanik manual bengkel)
  - picker barang kini juga memakai popup pencarian agar nyaman saat data stok banyak
  - keranjang dengan qty +/- dan hapus item, jasa manual, dan ringkasan transaksi dibuat ulang dengan layout yang lebih modern
  - fitur diskon, pembayaran parsial/hutang, dan kembalian tetap dipertahankan
- Data lama single-bengkel dihapus dari database dan diganti struktur baru multi-bengkel
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
  - halaman Barang diubah menjadi tabel dengan header kolom tetap saat daftar digulir
  - toolbar Barang kini berisi kolom pencarian, tombol tambah barang baru (modal), dan tombol refresh
  - struktur data barang diperluas: kode, nama, stok, satuan, harga modal, harga jual bengkel, harga jual konsumen, keterangan
  - edit barang dipindahkan ke modal khusus dan hanya admin yang dapat mengaksesnya
  - tombol hapus barang diletakkan di dalam modal edit admin
  - tabel Barang mendukung sorting berdasarkan kode, stok, dan harga
  - pagination halaman Barang ditambahkan untuk data inventori besar
  - badge warna stok langsung muncul di kolom stok agar item kritis cepat terlihat
  - page size tabel Barang kini otomatis menyesuaikan tinggi layar
  - kartu ringkasan total barang/stok menipis dihapus dari halaman Barang untuk tampilan lebih bersih
  - toolbar Barang dirapikan menjadi ikon saja untuk cari, tambah, dan refresh
  - ukuran tombol pada halaman Barang diperkecil agar tabel terasa lebih padat dan rapi
- layout halaman Barang kini fixed 1 layar: tombol aksi (tambah + sort + refresh) digabung dalam 1 baris ikon, parent screen tidak scroll, dan hanya area tabel yang scroll vertikal/horizontal
- footer pagination halaman Barang tetap terlihat di layar agar navigasi halaman tidak perlu dicari ke bawah
- Frontend Expo mobile dengan desain Swiss high-contrast:
  - layar login dan register
  - dashboard dengan statistik dan kartu menu
  - layar kasir dengan keranjang, jasa manual, total, dan bon HTML sederhana
  - layar bon/transaksi
  - layar daftar barang
  - layar detail bengkel
  - layar detail pengguna
- Font dan visual kini memakai arah lebih modern-minimal dengan Outfit + Figtree, radius lebih halus, card lebih bersih, dan hierarchy yang lebih elegan
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
  - self-test backend menegaskan update barang sekarang admin-only (kasir mendapat 403)
  - verifikasi UI Barang lulus untuk tabel, modal edit, dan close path modal
  - regression test sorting/pagination/badge barang lulus pada backend dan frontend
  - verifikasi UI tambahan lulus untuk toolbar icon-only dan page info dinamis di halaman Barang
  - self-test backend multi-bengkel lulus untuk owner register, employee pending→approve, create bengkel kedua, switch bengkel, cookie auth, dan isolasi inventori antar bengkel
  - regression test iteration_8 menandai bug register email-kosong + auth hardening gaps; semuanya sudah ditindaklanjuti
  - regression test iteration_9 untuk redesign kasir lulus untuk seluruh flow kasir baru; tersisa catatan edge-level CORS credentials pada public preflight preview yang tidak memblokir alur bearer-token aplikasi saat ini

## Backlog Prioritas

### P0
- Isi halaman placeholder di tab Menu: Pengaturan dan Tentang
- Tambah selector/indikator bengkel aktif yang lebih menonjol di luar halaman Detail Bengkel bila diperlukan
- Tambah retest penuh setelah perubahan auth multi-bengkel

### P1
- Export bon PDF/native share yang lebih kaya
- Ringkasan omzet per hari/minggu/bulan
- Notifikasi stok minimum dan badge jumlah stok kritis
- Ringkasan pelanggan dengan filter pelanggan/invoice yang lebih cepat

### P2
- Riwayat audit aktivitas pengguna
- Laporan servis per mekanik dan performa tim
- Preferensi tema, notifikasi, dan personalisasi UI

## Next Tasks
- Isi halaman Pengaturan dan Tentang
- Tambahkan analytics dashboard per periode bengkel aktif
- Tambahkan laporan omzet mingguan/bulanan dan ringkasan mekanik per bengkel