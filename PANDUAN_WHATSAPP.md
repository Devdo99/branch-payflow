# Panduan Pengaturan, Pengoperasian & Rangkuman WhatsApp Gateway

Dokumen ini berisi panduan lengkap untuk menginstal, menjalankan, mengoperasikan, serta memahami cara kerja **Sistem Gateway WhatsApp** pada aplikasi **Branch Payflow**.

---

## 🏗️ 1. Ikhtisar & Arsitektur Sistem

Sistem pengiriman slip gaji ini berjalan secara hibrida (hybrid) dengan membagi tugas antara sisi klien (frontend) dan server (backend) lokal:

* **[Frontend React (Vite + TanStack Start)](file:///D:/kreatif/branch-payflow/src/routes/_authenticated/slip-gaji.tsx):**
  * Memantau status koneksi backend (`http://localhost:5000/api/status`) secara berkala.
  * Menampilkan indikator status koneksi (Direct WA Active / Redirect WA Mode) di halaman kelola Slip Gaji.
  * Menyediakan kartu manajemen **WhatsApp Gateway** pada halaman Ringkasan WhatsApp untuk melihat status koneksi, memindai QR Code, dan memutus perangkat.
* **[Backend Node.js (Express + Baileys)](file:///D:/kreatif/branch-payflow/backend/server.js):**
  * Menggunakan pustaka `@whiskeysockets/baileys` yang sangat ringan untuk mengemulasi koneksi WhatsApp Web via WebSocket secara lokal.
  * Menyimpan sesi masuk secara otomatis di dalam folder `backend/auth_session/` agar tidak perlu scan ulang.
  * Menyediakan API lokal (`POST /api/send-message`) untuk mengirim pesan teks ringkasan gaji maupun berkas gambar slip gaji (JPG base64) secara instan di latar belakang dengan **satu klik saja**.
* **[start_payflow.bat (Launcher)](file:///D:/kreatif/branch-payflow/start_payflow.bat):**
  * Script otomatis untuk menyalakan server backend WhatsApp, server frontend Vite, dan membuka browser Anda secara bersamaan hanya dengan sekali klik.

---

## 🛠️ 2. Prasyarat & Instalasi Pertama Kali

Pastikan komputer Anda sudah terinstal:
* [Node.js](https://nodejs.org/) (versi 18 ke atas direkomendasikan)
* Pengelola paket `npm` atau `bun`

### Langkah Instalasi Dependency:
1. Buka terminal (PowerShell / Command Prompt) di folder proyek `D:\kreatif\branch-payflow`.
2. Jalankan perintah instalasi dependency frontend:
   ```bash
   npm install
   ```
3. Pindah ke folder backend dan jalankan instalasi dependency gateway WhatsApp:
   ```bash
   cd backend
   npm install
   ```

### Konfigurasi Database Supabase:
Pastikan file `.env` di folder root sudah terisi dengan kredensial proyek Supabase Anda:
* `VITE_SUPABASE_URL`
* `VITE_SUPABASE_ANON_KEY`
* `VITE_SUPABASE_PUBLISHABLE_KEY`
* `VITE_SUPABASE_PROJECT_ID`

---

## 🔌 3. Cara Menjalankan Aplikasi Sehari-hari

Untuk menggunakan fitur kirim WhatsApp langsung dalam satu klik, Anda memiliki beberapa cara untuk menjalankan server backend dan aplikasi web:

### Opsi A: Menggunakan Launcher `start_payflow.bat`
1. Pergi ke folder utama `D:\kreatif\branch-payflow`.
2. Klik dua kali berkas **[start_payflow.bat](file:///D:/kreatif/branch-payflow/start_payflow.bat)**.
3. Jendela konsol cmd akan terbuka untuk menyalakan server backend WhatsApp (port 5000) dan server frontend Vite (port 5173).
4. Browser Anda akan otomatis terbuka ke `http://localhost:5173`.

### Opsi B: Menggunakan Launcher Tanpa Membuka Browser (`start_payflow_tanpa_browser.bat`)
Jika Anda ingin menyalakan server backend WhatsApp dan frontend Vite secara bersamaan lewat terminal/CMD **tanpa otomatis membuka browser**:
1. Pergi ke folder utama `D:\kreatif\branch-payflow`.
2. Klik dua kali berkas **[start_payflow_tanpa_browser.bat](file:///D:/kreatif/branch-payflow/start_payflow_tanpa_browser.bat)**.
3. Kedua server akan menyala di latar belakang, dan Anda dapat mengakses frontend secara manual di `http://localhost:5173`.

### Opsi C: Hanya Menjalankan Backend WhatsApp (`start_wa_only.bat`)
Jika Anda hanya ingin menjalankan server backend WhatsApp Gateway saja (port 5000) tanpa menjalankan frontend Vite maupun membuka browser:
1. Pergi ke folder utama `D:\kreatif\branch-payflow`.
2. Klik dua kali berkas **[start_wa_only.bat](file:///D:/kreatif/branch-payflow/start_wa_only.bat)**.
3. Jendela terminal akan menampilkan log sistem WhatsApp Gateway. Jika belum masuk, QR Code akan otomatis dicetak langsung di dalam terminal ini untuk dipindai.

### Opsi D: Menjalankan Secara Manual lewat Terminal
Jika ingin memantau konsol secara manual di dua terminal berbeda:
* **Terminal 1 (Backend WA saja):**
  ```bash
  cd D:\kreatif\branch-payflow\backend
  npm start
  ```
* **Terminal 2 (Frontend saja):**
  ```bash
  cd D:\kreatif\branch-payflow
  npm run dev
  ```

---

## 📲 4. Cara Menghubungkan WhatsApp Anda

Hubungkan nomor WhatsApp pengirim Anda melalui antarmuka web:

1. Buka aplikasi web di browser (`http://localhost:5173`).
2. Masuk ke halaman **Ringkasan WhatsApp** (`/ringkasan-whatsapp`).
3. Di sisi kanan pada kartu **WhatsApp Gateway**:
   * Jika status server mati, pastikan server backend sudah menyala dengan menjalankan launcher `start_payflow.bat`.
   * Jika status terputus, sistem akan otomatis menghasilkan dan menampilkan **QR Code** di layar.
4. Buka aplikasi **WhatsApp di HP** Anda.
5. Ketuk ikon menu (titik tiga di kanan atas pada Android, atau Pengaturan di kanan bawah pada iOS) $\rightarrow$ Pilih **Perangkat Tertaut (Linked Devices)**.
6. Ketuk **Tautkan Perangkat (Link a Device)**.
7. Arahkan kamera HP Anda ke **QR Code** yang muncul di layar browser Anda.
8. Tunggu beberapa saat hingga proses sinkronisasi selesai. Status koneksi di web akan berubah menjadi **Terhubung (Hijau / Online)**.

> [!NOTE]
> Sesi koneksi akan disimpan secara otomatis di folder `backend/auth_session/`. Anda tidak perlu mengulang proses scan QR ini setiap hari. Jika server backend dimatikan atau laptop dinyalakan ulang, Baileys akan otomatis masuk (*autoreconnect*) menggunakan sesi yang tersimpan ketika backend dinyalakan kembali.

---

## 💬 5. Cara Pengiriman Slip Gaji (Satu Klik)

Proses pengiriman slip gaji dilakukan melalui halaman **Slip Gaji** (`/slip-gaji`):

1. Pastikan status WhatsApp Gateway di bagian header halaman bernilai **Direct WA Active** (Hijau).
2. Cari nama karyawan yang dituju pada tabel slip gaji.
3. Klik tombol WhatsApp yang diinginkan:
   * **💬 Kirim WA Teks (Ikon MessageSquare):**
     * Mengirim rangkuman teks slip gaji (berdasarkan template yang diatur di `/format-whatsapp`) langsung ke nomor WhatsApp karyawan di latar belakang secara instan dalam **satu kali klik** tanpa membuka tab baru.
   * **🖼️ Kirim WA Slip Gambar (Ikon Kirim/Send):**
     * Menghasilkan gambar JPG slip gaji beresolusi tinggi, lalu mengirimkan gambar tersebut beserta pesan deskripsi pengantar langsung ke nomor WhatsApp karyawan di latar belakang dalam **satu kali klik** tanpa membuka tab baru.
4. Setelah pesan sukses terkirim, status pengiriman slip di database Supabase otomatis ter-update menjadi **Terkirim** (indikator progress di halaman Ringkasan WhatsApp akan bertambah).

### 🔄 Sistem Cadangan (Fallback System):
Jika status gateway bernilai **Redirect WA Mode** (karena server backend mati atau nomor WhatsApp belum ditautkan), sistem secara cerdas akan mengalihkan metode ke **pengalihan link browser (`wa.me` redirect)**. 
* Anda akan diarahkan untuk mengirim manual di tab WhatsApp Web baru seperti biasa.
* File gambar JPG slip tetap diunduh otomatis ke komputer Anda agar dapat dilampirkan secara manual.

---

## 🧹 6. Cara Keluar / Putus Koneksi (Logout)

Jika Anda ingin mengganti nomor WhatsApp pengirim:
1. Masuk ke halaman **Ringkasan WhatsApp**.
2. Klik tombol **Putuskan Perangkat** di kartu WhatsApp Gateway.
3. Folder sesi `backend/auth_session/` akan dihapus dan server backend akan memuat ulang lalu bersiap menampilkan QR Code baru untuk akun lainnya.

---

## 📂 7. Struktur & Daftar Berkas Terkait

* **`D:\kreatif\branch-payflow\backend\`**: Folder server gateway WhatsApp lokal.
  * **[server.js](file:///D:/kreatif/branch-payflow/backend/server.js)**: Logika utama gateway Baileys, rest API, dan penanganan session.
  * **`package.json`**: Daftar dependensi server backend.
  * **`auth_session/`**: *(Otomatis dibuat)* Folder penyimpanan file token sesi WhatsApp Anda.
* **`D:\kreatif\branch-payflow\src\`**: Folder frontend React.
  * **[src/routes/_authenticated/slip-gaji.tsx](file:///D:/kreatif/branch-payflow/src/routes/_authenticated/slip-gaji.tsx)**: Halaman kelola slip gaji yang mendeteksi status gateway dan memicu pengiriman sekali klik.
  * **[src/routes/_authenticated/ringkasan-whatsapp.tsx](file:///D:/kreatif/branch-payflow/src/routes/_authenticated/ringkasan-whatsapp.tsx)**: Dashboard pemantauan statistik pengiriman slip dan kartu manajemen koneksi WhatsApp Gateway.
  * **[src/routes/_authenticated/format-whatsapp.tsx](file:///D:/kreatif/branch-payflow/src/routes/_authenticated/format-whatsapp.tsx)**: Pengaturan template teks slip gaji karyawan.
* **`D:\kreatif\branch-payflow\start_payflow.bat`**: Script *launcher* ekosistem lokal untuk menyalakan frontend, backend, dan membuka browser.
* **`D:\kreatif\branch-payflow\start_payflow_tanpa_browser.bat`**: Script *launcher* ekosistem lokal untuk menyalakan frontend & backend tanpa membuka browser.
* **`D:\kreatif\branch-payflow\start_wa_only.bat`**: Script *launcher* untuk hanya menyalakan backend WhatsApp Gateway saja.
