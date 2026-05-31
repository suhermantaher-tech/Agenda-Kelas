# 📚 Egenda Kelas — SMAN 5 Sarolangun

> Aplikasi Agenda Kelas Interaktif berbasis web untuk pencatatan kegiatan belajar mengajar (KBM) secara digital dan real-time.

---

## 🔗 Link Akses Aplikasi

| Portal | URL | Pengguna |
|--------|-----|----------|
| 🏠 Menu Utama | https://suhermantaher-tech.github.io/egenda-kelas/ | Semua |
| 👨‍🏫 Portal Guru | https://suhermantaher-tech.github.io/egenda-kelas/portal-guru/ | Guru |
| 📺 Monitor TV | https://suhermantaher-tech.github.io/egenda-kelas/monitor-tv/ | Ruang Guru |
| ⚙️ Dashboard Admin | https://suhermantaher-tech.github.io/egenda-kelas/dashboard-admin/ | Admin |
| 📊 Portal Kepsek | https://suhermantaher-tech.github.io/egenda-kelas/dashboard-kepsek/ | Kepala Sekolah |

---

## 📁 Struktur Folder

```
egenda-kelas/
├── index.html                  ← Halaman menu utama
├── README.md                   ← File ini
├── shared/
│   ├── logo.jpg                ← Logo SMAN 5 Sarolangun
│   └── firebase-config.js      ← Konfigurasi Firebase
├── portal-guru/
│   └── index.html              ← Form input agenda (login PIN)
├── monitor-tv/
│   └── index.html              ← Layar monitor real-time
├── dashboard-admin/
│   └── index.html              ← Laporan & manajemen data
└── dashboard-kepsek/
    └── index.html              ← Ringkasan eksekutif
```

---

## ⚙️ Teknologi yang Digunakan

- **Frontend** : HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Database** : Firebase Firestore (real-time NoSQL)
- **Auth**     : Firebase Authentication (PIN guru, Email admin)
- **Hosting**  : GitHub Pages (gratis, tanpa server)
- **Font**     : Plus Jakarta Sans, DM Mono (Google Fonts)

---

## 🗄️ Struktur Database Firestore

| Koleksi | Fungsi |
|---------|--------|
| `Data_Guru` | Master data & PIN login guru |
| `Jadwal_Pelajaran` | Jadwal KBM per hari & semester |
| `Agenda_Harian` | Rekaman input agenda setiap sesi |
| `Notifikasi_Log` | Riwayat notifikasi & pengingat |
| `Rekap_Periode` | Cache rekap mingguan/bulanan/semester |

---

## 👤 Cara Menambah Data Guru Baru

1. Buka [Firebase Console](https://console.firebase.google.com) → project `agedasmanli`
2. Buka **Firestore Database** → koleksi **Data_Guru**
3. Klik **Add document** → Identifikasi Otomatis
4. Isi field berikut:

| Field | Jenis | Contoh |
|-------|-------|--------|
| `nama_lengkap` | string | `Suherman Taher, S.Pd` |
| `nip` | string | `197001012000011001` |
| `pin_login` | string | `1234` |
| `no_hp` | string | `08123456789` |
| `status_aktif` | boolean | `true` |

> ⚠️ PIN harus unik untuk setiap guru. Gunakan 4 digit angka.

---

## 📅 Cara Menambah Jadwal Pelajaran

1. Firestore → koleksi **Jadwal_Pelajaran** → **Add document**
2. Isi field berikut:

| Field | Jenis | Contoh |
|-------|-------|--------|
| `id_guru` | string | *(salin ID dokumen dari Data_Guru)* |
| `hari` | string | `Senin` |
| `kelas` | string | `X IPA 1` |
| `mata_pelajaran` | string | `Matematika` |
| `jam_ke` | number | `1` |
| `jam_mulai` | string | `07:00` |
| `jam_selesai` | string | `07:45` |
| `semester` | string | `Ganjil` |
| `tahun_ajaran` | string | `2025/2026` |

> ⚠️ Nilai `hari` harus diawali huruf kapital: `Senin`, `Selasa`, `Rabu`, `Kamis`, `Jumat`

---

## 🔄 Cara Update Aplikasi

1. Edit file HTML yang diinginkan
2. Upload ulang ke GitHub (Add file → Upload files)
3. GitHub Pages otomatis memperbarui dalam 1–2 menit

---

## 🔒 Keamanan

- PIN guru disimpan di Firestore (bukan di kode)
- Firebase Security Rules memastikan data hanya bisa diakses pengguna yang login
- API Key Firebase aman digunakan di frontend karena dilindungi Security Rules

---

## 📞 Kontak & Pengembang

**SMAN 5 Sarolangun** · Kreatif & Berkarakter  
Dikembangkan untuk kebutuhan internal sekolah · 2025
