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
  - halaman Menu kini dimulai langsung dari daftar card tanpa header judul/subjudul, tanpa card "Bengkel aktif", dan area logout dibuat sangat ringkas (hanya tombol keluar)
  - halaman Detail Bengkel menampilkan ID bengkel, switch bengkel, form profil, approval karyawan, dan tambah bengkel baru
  - halaman Detail Pengguna kini fokus pada anggota aktif bengkel + ubah role/hapus akses
- Halaman Kasir dirombak mengikuti ilustrasi baru:
  - mode pelanggan `Konsumen/Bengkel` aktif dan memengaruhi harga barang (`consumer_price` vs `workshop_price`)
  - pelanggan kini dipilih lewat tombol + popup pencarian dari data bengkel; jika belum ada, pelanggan baru bisa langsung ditambahkan ke data bengkel dan otomatis terpilih
  - mekanik dipindahkan ke bagian Data Transaksi dan dipilih lewat popup dari data bengkel (gabungan user role mekanik + daftar mekanik manual bengkel)
  - jika mode pelanggan = `Bengkel`, field mekanik otomatis disembunyikan
  - picker barang kini juga memakai popup pencarian agar nyaman saat data stok banyak
  - jasa manual kini juga memakai popup agar tampilan utama kasir lebih rapi
  - saat ada uang kembalian, kasir mendapat keputusan `Simpan kembalian / Selesai`; jika dikembalikan langsung oleh kasir maka transaksi disimpan sebagai lunas dan catatan otomatis ditambahkan
  - keranjang dengan qty +/- dan hapus item, serta ringkasan transaksi dibuat ulang dengan layout yang lebih modern
  - state edit transaksi kasir kini di-reset saat batal edit, sehingga kasir bisa kembali membuat transaksi baru dengan bersih
  - spacing atas global pada layar berbasis ScreenShell diperkecil agar card/konten mulai lebih rapat dan rapi
  - popup pelanggan/mekanik/barang/jasa di kasir kini lebih aman untuk Android saat keyboard terbuka
  - halaman Transaksi tidak lagi memanjang membuka detail di card pelanggan; klik pelanggan sekarang membuka halaman baru berisi seluruh riwayat transaksi pelanggan dalam bentuk card, urutan terbaru di atas, plus ringkasan jumlah transaksi dan total belanja
  - card `Pilih barang` dan `Input jasa manual` di kasir kini digabung menjadi satu card `Transaksi` dengan dua tombol 50:50, keterangan tambahan dihapus, tombol mode pelanggan dibuat sama besar dan rata, serta skala tombol diperkecil lagi agar layout lebih padat
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

### 2026-05-15
- Penyempurnaan UI halaman Barang dan Menu selesai:
  - toolbar halaman Barang diperkecil lagi agar lebih padat di layar mobile
  - tombol `Kolom` ditambahkan sebelum tombol refresh untuk memilih kolom tabel yang tampil/sembunyi
  - modal pemilihan kolom mendukung toggle cepat untuk kode, nama, stok, satuan, harga modal, harga bengkel, harga konsumen, dan keterangan
  - halaman Menu diubah dari list vertikal menjadi grid ikon kotak 2 kolom yang lebih rapi
  - tombol `Keluar` dihapus dari tab Menu dan dipindahkan ke halaman `Pengaturan > Sistem`
- Verifikasi UI tambahan:
  - pengecekan visual Menu grid, tombol logout di Pengaturan, dan modal pilihan kolom Barang lulus via screenshot preview lokal web

### 2026-05-16
- Redesign auth dan penyelarasan tema aplikasi:
  - halaman Login dirombak mengikuti referensi baru: kartu putih besar, ikon biru, judul biru, input clean, dan tombol gradient biru-ungu
  - halaman Register kini memakai tema yang sama dengan toggle `Pemilik Bengkel / Karyawan`
  - field register disederhanakan sesuai alur baru: username, nama lengkap, password, email, lalu `Nama Bengkel` atau `ID Bengkel` tergantung tipe akun
  - pilihan role saat karyawan daftar dihapus dari UI; backend tetap menerima pendaftaran karyawan tanpa pilihan role dari form
  - warna global aplikasi digeser ke tema biru-putih agar Dashboard, Kasir, Menu, Barang, dan layar lain terasa seragam
- Perbaikan alur Kasir:
  - setiap kali tab Kasir dibuka kembali dalam mode transaksi baru, form kasir otomatis di-reset agar sisa draft transaksi tidak terbawa
- Verifikasi tambahan:
  - screenshot lokal lulus untuk Login baru, Register baru, Dashboard/Menu/Kasir bertema baru, dan reset form Kasir saat pindah tab
  - self-test backend lulus untuk register karyawan tanpa role dari frontend payload

### 2026-05-16 (lanjutan)
- Penyempurnaan layar operasional dan menu informasi:
  - halaman Pengaturan diisi dengan aksi cepat (refresh profil, detail bengkel, detail pengguna, backup) plus panduan operasional singkat
  - halaman Tentang diisi dengan ringkasan fungsi aplikasi, daftar kemampuan utama, dan alur kerja cepat
  - toolbar halaman Barang diperkecil lagi agar tombol tambah, urutkan, kolom, dan refresh muat dalam satu baris
  - toolbar halaman Transaksi diperkecil agar pencarian, filter, dan refresh lebih ringkas di mobile
  - reset halaman Kasir diperketat lagi; saat tab Kasir dibuka ulang, draft transaksi dibersihkan, dan state edit ikut dibersihkan saat meninggalkan mode edit
- Verifikasi tambahan:
  - screenshot lokal lulus untuk Pengaturan fungsional, Tentang fungsional, toolbar Barang/Transaksi yang lebih ringkas, dan reset Kasir saat pindah tab

### 2026-05-17
- Penyempurnaan seluruh popup agar lebih konsisten:
  - popup Kasir (pelanggan, mekanik, barang, jasa, keputusan kembalian) dipusatkan ke tengah layar
  - popup Inventory form dan popup filter Transaksi juga dipindahkan ke tengah layar
  - popup dengan input/list kini dibungkus `KeyboardAvoidingView` + area scroll agar lebih aman saat keyboard virtual Android muncul
  - daftar saran pelanggan, mekanik, dan barang dibuat tetap scrollable dengan `keyboardShouldPersistTaps` agar tidak mudah tertutup keyboard
  - tinggi popup daftar dipendekkan lagi supaya area tombol bawah tetap lebih mudah terlihat
- Verifikasi tambahan:
  - pengecekan singkat via screenshot lokal untuk popup utama setelah dipusatkan (tanpa pengujian mendalam sesuai arahan user)

### 2026-05-20
- Penyempurnaan auth, popup, dan manajemen karyawan:
  - halaman Login dan Register dipadatkan lagi agar lebih pas di layar ponsel
  - teks `Pilih jenis akun` di Register dihapus; tombol `Pemilik Bengkel / Karyawan` sekarang langsung tampil
  - helper teks role karyawan di Register dihapus agar form lebih ringkas
  - tinggi popup Kasir dibuat lebih adaptif per jenis popup (selector, daftar barang, popup ringkas) supaya lebih pas di layar kecil
  - saat nama mekanik baru dipakai dari Kasir/transaksi, sistem otomatis membuat akun karyawan mekanik aktif di bengkel tersebut dengan username sistem
  - halaman Detail Pengguna kini punya kontrol owner/admin untuk `Simpan Password` atau `Reset Otomatis` password karyawan
- Verifikasi tambahan:
  - self-test backend lulus untuk: register owner baru, auto-create akun mekanik, reset password mekanik, dan login akun mekanik hasil reset
  - screenshot lokal lulus untuk Login compact, Register compact tanpa teks tambahan, dan kontrol password karyawan di halaman Detail Pengguna

## Backlog Prioritas

### P0
- Lengkapi isi halaman Pengaturan dan Tentang agar lebih fungsional dari sekadar informasi statis
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
- Tambahkan fitur lanjutan di Pengaturan dan Tentang bila dibutuhkan (preferensi, bantuan, changelog)
- Terapkan polish visual tambahan ke halaman Detail Bengkel, Detail Pengguna, dan Transaksi agar setara dengan tema auth baru
- Tambahkan analytics dashboard per periode bengkel aktif
- Tambahkan laporan omzet mingguan/bulanan dan ringkasan mekanik per bengkel