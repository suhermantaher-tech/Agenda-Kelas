// ══════════════════════════════════════════════════════════
// shared/pelanggaran-widget.js
// Komponen bersama fitur "Pelanggaran Siswa" — CMA v3.0
// Dipakai di: portal-guru, wali-kelas, portal-bk
//
// Cara pakai (di dalam <script type="module"> masing-masing portal,
// SETELAH db & auth diinisialisasi):
//
//   import { initPelanggaranWidget } from '../shared/pelanggaran-widget.js';
//
//   initPelanggaranWidget({
//     db,                              // instance Firestore yang sudah ada
//     mode: 'guru',                    // 'guru' | 'wali_kelas' | 'bk'
//     currentUser: { id: idGuruLogin, nama: namaGuruLogin },
//     tahunAjaran: '2025/2026',
//     semester: 'Ganjil',
//     getSiswaList: async (teks) => {
//       // WAJIB diisi beda per portal — lihat catatan di bawah
//       // return [{ id, nama, nis, kelas }, ...]
//     },
//     onScanQR: async () => {          // opsional, hanya dipakai mode 'guru'
//       // return { id, nama, nis, kelas } dari hasil pindai, atau null
//     }
//   });
//
// Sumber daftar siswa per portal (isi getSiswaList sesuai ini):
//   - portal-guru   : saring dari Jadwal_Pelajaran guru login + jam berjalan
//   - wali-kelas    : saring dari Rombel/Data_Siswa milik kelas yang diampu
//   - portal-bk     : pencarian bebas lintas kelas dari Data_Siswa
// ══════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, getDocs, query, where,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Tabel 8 level tindakan — Bagian D Pedoman Tata Tertib
const LEVEL_TABLE = [
  { level: 1, min: 1,  max: 15,  nama: 'Pembinaan Lisan' },
  { level: 2, min: 16, max: 25,  nama: 'Peringatan Tertulis I' },
  { level: 3, min: 26, max: 50,  nama: 'Pemanggilan Orang Tua I' },
  { level: 4, min: 51, max: 65,  nama: 'Surat Pernyataan I' },
  { level: 5, min: 66, max: 75,  nama: 'Surat Pernyataan II & Skorsing Edukatif' },
  { level: 6, min: 76, max: 85,  nama: 'Surat Pernyataan III & Skorsing' },
  { level: 7, min: 86, max: 95,  nama: 'Konferensi Kasus' },
  { level: 8, min: 96, max: 999, nama: 'Pengembalian kepada Orang Tua' },
];

function levelDari(poin) {
  return LEVEL_TABLE.find(l => poin >= l.min && poin <= l.max) || LEVEL_TABLE[LEVEL_TABLE.length - 1];
}

const KATEGORI_WARNA = {
  ringan: { bg: '#E8F5E9', border: '#A5D6A7', teks: '#1B5E20', label: 'Ringan' },
  sedang: { bg: '#FFF3E0', border: '#FFCC80', teks: '#B85510', label: 'Sedang' },
  berat:  { bg: '#FDE8E8', border: '#F5A0A0', teks: '#C62828', label: 'Berat' },
};

let cfg = null;
let masterCache = [];
let step = 1;
let siswaTerpilih = null;
let jenisTerpilih = null;
let debounceTimer = null;

export async function initPelanggaranWidget(config) {
  if (!config || !config.db || !config.mode || !config.currentUser || !config.getSiswaList) {
    console.error('[pelanggaran-widget] config tidak lengkap: db, mode, currentUser, getSiswaList wajib diisi');
    return;
  }
  cfg = config;
  await muatMaster();
  suntikStyle();
  suntikHTML();
  pasangEvent();
}

async function muatMaster() {
  try {
    const snap = await getDocs(query(collection(cfg.db, 'Master_Pelanggaran'), where('aktif', '==', true)));
    masterCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[pelanggaran-widget] gagal memuat Master_Pelanggaran', e);
    masterCache = [];
  }
}

function suntikStyle() {
  if (document.getElementById('plgw-style')) return;
  const style = document.createElement('style');
  style.id = 'plgw-style';
  style.textContent = `
    .plgw-fab {
      position: fixed; right: 18px; bottom: 22px; z-index: 2147483000;
      width: 58px; height: 58px; border-radius: 50%;
      background: #C62828; color: #fff; border: none;
      box-shadow: 0 4px 14px rgba(198,40,40,0.4);
      font-size: 26px; display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    }
    .plgw-fab:active { transform: scale(0.94); }
    .plgw-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 2147483000;
      display: none; align-items: flex-end; justify-content: center;
    }
    .plgw-overlay.tampil { display: flex; }
    .plgw-sheet {
      width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto;
      background: #fff; border-radius: 18px 18px 0 0; padding: 18px;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .plgw-dots { display: flex; gap: 6px; justify-content: center; margin-bottom: 14px; }
    .plgw-dot { width: 24px; height: 4px; border-radius: 2px; background: #E2E8F0; }
    .plgw-dot.aktif { background: #C62828; }
    .plgw-judul { font-size: 15px; font-weight: 700; color: #1A2332; margin: 0 0 10px; }
    .plgw-sub { font-size: 12px; color: #5A6A7E; margin: -6px 0 12px; }
    .plgw-input {
      width: 100%; padding: 10px 12px; border: 1.5px solid #E2E8F0; border-radius: 10px;
      font-size: 14px; margin-bottom: 10px; font-family: inherit;
    }
    .plgw-btn-row { display: flex; gap: 8px; margin-bottom: 10px; }
    .plgw-btn {
      flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid #E2E8F0;
      background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; color: #1A2332;
    }
    .plgw-btn.scan { background: #FDE8E8; border-color: #F5A0A0; color: #C62828; }
    .plgw-siswa-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 11px 6px; border-bottom: 1px solid #EEF1F5; cursor: pointer;
    }
    .plgw-siswa-item:active { background: #F5F6FA; }
    .plgw-kat-label { font-size: 12px; font-weight: 700; margin: 10px 0 6px; }
    .plgw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px; }
    .plgw-card {
      border-radius: 10px; padding: 10px; cursor: pointer; border: 1.5px solid;
    }
    .plgw-card p { margin: 0; }
    .plgw-card .nama { font-size: 12.5px; font-weight: 700; }
    .plgw-card .poin { font-size: 11.5px; margin-top: 2px; }
    .plgw-ringkasan { background: #F5F6FA; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
    .plgw-ringkasan table { width: 100%; font-size: 13px; }
    .plgw-ringkasan td { padding: 4px 0; }
    .plgw-ringkasan td:first-child { color: #5A6A7E; }
    .plgw-ringkasan td:last-child { text-align: right; font-weight: 600; }
    .plgw-simpan {
      width: 100%; padding: 12px; border-radius: 10px; border: none;
      background: #C62828; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer;
      margin-bottom: 8px;
    }
    .plgw-close-row { display: flex; gap: 8px; margin-top: 8px; }
    .plgw-toast {
      position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%) translateY(20px);
      background: #1A2332; color: #fff; padding: 10px 18px; border-radius: 10px;
      font-size: 13px; z-index: 2147483000; opacity: 0; transition: 0.25s; pointer-events: none;
    }
    .plgw-toast.tampil { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;
  document.head.appendChild(style);
}

function suntikHTML() {
  if (document.getElementById('plgw-root')) return;
  const root = document.createElement('div');
  root.id = 'plgw-root';
  root.innerHTML = `
    <button class="plgw-fab" id="plgw-fab" aria-label="Lapor pelanggaran siswa">🚨</button>
    <div class="plgw-overlay" id="plgw-overlay">
      <div class="plgw-sheet">
        <div class="plgw-dots">
          <div class="plgw-dot aktif" data-s="1"></div>
          <div class="plgw-dot" data-s="2"></div>
          <div class="plgw-dot" data-s="3"></div>
        </div>

        <div id="plgw-step1">
          <div class="plgw-judul">Cari siswa</div>
          ${cfg.mode === 'guru' ? '<div class="plgw-btn-row"><button class="plgw-btn scan" id="plgw-scan">📷 Pindai kartu</button></div>' : ''}
          <input type="text" class="plgw-input" id="plgw-cari" placeholder="Ketik nama siswa...">
          <div id="plgw-hasil"></div>
        </div>

        <div id="plgw-step2" style="display:none">
          <div class="plgw-judul">Pilih pelanggaran</div>
          <div class="plgw-sub" id="plgw-siswa-terpilih"></div>
          <div id="plgw-grid-wrap"></div>
        </div>

        <div id="plgw-step3" style="display:none">
          <div class="plgw-judul">Konfirmasi</div>
          <div class="plgw-ringkasan">
            <table>
              <tr><td>Siswa</td><td id="plgw-k-siswa"></td></tr>
              <tr><td>Kelas</td><td id="plgw-k-kelas"></td></tr>
              <tr><td>Pelanggaran</td><td id="plgw-k-jenis"></td></tr>
              <tr><td>Kategori</td><td id="plgw-k-kategori"></td></tr>
              <tr><td>Poin</td><td id="plgw-k-poin"></td></tr>
              <tr><td>Pelapor</td><td>${escapeHtml(cfg.currentUser.nama || '')}</td></tr>
            </table>
          </div>
          <button class="plgw-simpan" id="plgw-simpan">Simpan pelanggaran</button>
        </div>

        <div class="plgw-close-row">
          <button class="plgw-btn" id="plgw-back" style="display:none">Kembali</button>
          <button class="plgw-btn" id="plgw-tutup">Tutup</button>
        </div>
      </div>
    </div>
    <div class="plgw-toast" id="plgw-toast"></div>
  `;
  (cfg.mountTarget || document.body).appendChild(root);
}

function pasangEvent() {
  document.getElementById('plgw-fab').addEventListener('click', () => {
    try { bukaSheet(); } catch (e) { console.error('[pelanggaran-widget] gagal membuka panel:', e); }
  });
  document.getElementById('plgw-tutup').addEventListener('click', tutupSheet);
  document.getElementById('plgw-overlay').addEventListener('click', e => {
    if (e.target.id === 'plgw-overlay') tutupSheet();
  });
  document.getElementById('plgw-back').addEventListener('click', () => gotoStep(step - 1));
  document.getElementById('plgw-simpan').addEventListener('click', simpanCatatan);

  document.getElementById('plgw-cari').addEventListener('input', e => {
    clearTimeout(debounceTimer);
    const teks = e.target.value.trim();
    debounceTimer = setTimeout(() => cariSiswa(teks), 250);
  });

  const btnScan = document.getElementById('plgw-scan');
  if (btnScan && cfg.onScanQR) {
    btnScan.addEventListener('click', async () => {
      const hasil = await cfg.onScanQR();
      if (hasil) pilihSiswa(hasil);
    });
  }
}

function bukaSheet() {
  gotoStep(1);
  document.getElementById('plgw-overlay').classList.add('tampil');
  cariSiswa('');
}

function tutupSheet() {
  document.getElementById('plgw-overlay').classList.remove('tampil');
  siswaTerpilih = null;
  jenisTerpilih = null;
  document.getElementById('plgw-cari').value = '';
}

function gotoStep(n) {
  step = n;
  document.getElementById('plgw-step1').style.display = n === 1 ? 'block' : 'none';
  document.getElementById('plgw-step2').style.display = n === 2 ? 'block' : 'none';
  document.getElementById('plgw-step3').style.display = n === 3 ? 'block' : 'none';
  document.getElementById('plgw-back').style.display = n > 1 ? 'block' : 'none';
  document.querySelectorAll('.plgw-dot').forEach(d => {
    d.classList.toggle('aktif', Number(d.dataset.s) <= n);
  });
}

async function cariSiswa(teks) {
  const hasilEl = document.getElementById('plgw-hasil');
  hasilEl.innerHTML = '<div style="padding:10px 4px;color:#8A9BAE;font-size:13px">Memuat...</div>';
  try {
    const hasilMentah = await cfg.getSiswaList(teks);
    const list = urutkanSiswa(hasilMentah, teks);
    if (!list || !list.length) {
      hasilEl.innerHTML = '<div style="padding:10px 4px;color:#8A9BAE;font-size:13px">Tidak ada siswa ditemukan</div>';
      return;
    }
    hasilEl.innerHTML = list.map(s => `
      <div class="plgw-siswa-item" data-id="${escapeHtml(s.id)}">
        <span>${escapeHtml(s.nama)}</span>
        <span style="font-size:12px;color:#8A9BAE">${escapeHtml(s.kelas || '')}</span>
      </div>
    `).join('');
    hasilEl.querySelectorAll('.plgw-siswa-item').forEach((el, i) => {
      el.addEventListener('click', () => pilihSiswa(list[i]));
    });
  } catch (e) {
    hasilEl.innerHTML = '<div style="padding:10px 4px;color:#C62828;font-size:13px">Gagal memuat daftar siswa</div>';
    console.error('[pelanggaran-widget] getSiswaList error', e);
  }
}

// Urutkan A-Z; kalau ada teks pencarian, nama yang DIAWALI teks tersebut naik ke atas dulu
// (baru sisanya yang cocok di tengah/akhir nama), supaya hasil paling relevan terlihat duluan.
function urutkanSiswa(list, teks) {
  if (!list) return [];
  const t = (teks || '').trim().toLowerCase();
  return [...list].sort((a, b) => {
    const na = (a.nama || '').toLowerCase();
    const nb = (b.nama || '').toLowerCase();
    if (t) {
      const aAwal = na.startsWith(t) ? 0 : 1;
      const bAwal = nb.startsWith(t) ? 0 : 1;
      if (aAwal !== bAwal) return aAwal - bAwal;
    }
    return (a.nama || '').localeCompare(b.nama || '', 'id');
  });
}

function pilihSiswa(siswa) {
  siswaTerpilih = siswa;
  document.getElementById('plgw-siswa-terpilih').textContent = `${siswa.nama} · ${siswa.kelas || ''}`;
  renderGrid();
  gotoStep(2);
}

function renderGrid() {
  const wrap = document.getElementById('plgw-grid-wrap');
  const kategoris = ['ringan', 'sedang', 'berat'];
  wrap.innerHTML = kategoris.map(kat => {
    const items = masterCache.filter(m => m.kategori === kat);
    if (!items.length) return '';
    const w = KATEGORI_WARNA[kat];
    return `
      <div class="plgw-kat-label" style="color:${w.teks}">${w.label}</div>
      <div class="plgw-grid">
        ${items.map(it => `
          <div class="plgw-card" data-id="${it.id}" style="background:${w.bg};border-color:${w.border}">
            <p class="nama" style="color:${w.teks}">${escapeHtml(it.nama)}</p>
            <p class="poin" style="color:${w.teks}">${it.poin} poin</p>
          </div>
        `).join('')}
      </div>
    `;
  }).join('') || '<div style="padding:16px 4px;color:#8A9BAE;font-size:13px">Master data pelanggaran belum diisi admin</div>';

  wrap.querySelectorAll('.plgw-card').forEach(el => {
    el.addEventListener('click', () => {
      jenisTerpilih = masterCache.find(m => m.id === el.dataset.id);
      if (jenisTerpilih) pilihJenis();
    });
  });
}

function pilihJenis() {
  document.getElementById('plgw-k-siswa').textContent = siswaTerpilih.nama;
  document.getElementById('plgw-k-kelas').textContent = siswaTerpilih.kelas || '—';
  document.getElementById('plgw-k-jenis').textContent = jenisTerpilih.nama;
  document.getElementById('plgw-k-kategori').textContent = KATEGORI_WARNA[jenisTerpilih.kategori].label;
  document.getElementById('plgw-k-poin').textContent = jenisTerpilih.poin;
  gotoStep(3);
}

async function simpanCatatan() {
  if (!siswaTerpilih || !jenisTerpilih) return;
  const btn = document.getElementById('plgw-simpan');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    await addDoc(collection(cfg.db, 'Catatan_Pelanggaran'), {
      id_siswa: siswaTerpilih.id,
      nama_siswa: siswaTerpilih.nama,
      nis: siswaTerpilih.nis || '',
      kelas: siswaTerpilih.kelas || '',
      id_jenis: jenisTerpilih.id,
      kode_jenis: jenisTerpilih.kode,
      nama_jenis: jenisTerpilih.nama,
      kategori: jenisTerpilih.kategori,
      poin: jenisTerpilih.poin,
      waktu: serverTimestamp(),
      id_guru_pelapor: cfg.currentUser.id,
      nama_guru_pelapor: cfg.currentUser.nama,
      peran_pelapor: cfg.mode,
      tahun_ajaran: cfg.tahunAjaran || '',
      semester: cfg.semester || '',
    });

    await perbaruiRekapPoin(siswaTerpilih, jenisTerpilih.poin);

    tampilkanToast('✅ Pelanggaran tersimpan');
    tutupSheet();
  } catch (e) {
    console.error('[pelanggaran-widget] gagal menyimpan', e);
    tampilkanToast('❌ Gagal menyimpan, cek koneksi');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan pelanggaran';
  }
}

// Transaction supaya akumulasi poin akurat walau ada input bersamaan dari guru berbeda
async function perbaruiRekapPoin(siswa, poinBaru) {
  const idRekap = `${siswa.id}_${(cfg.tahunAjaran || 'default').replace(/\//g, '-')}`;
  const ref = doc(cfg.db, 'Rekap_Poin_Siswa', idRekap);

  await runTransaction(cfg.db, async (tx) => {
    const snap = await tx.get(ref);
    const sebelum = snap.exists() ? snap.data() : { total_poin: 0, riwayat_level: [] };
    const totalBaru = (sebelum.total_poin || 0) + poinBaru;
    const levelBaru = levelDari(totalBaru);
    const levelSebelumnya = sebelum.level_saat_ini || 0;

    const riwayat = sebelum.riwayat_level || [];
    if (levelBaru.level !== levelSebelumnya) {
      riwayat.push({ level: levelBaru.level, nama_level: levelBaru.nama, tanggal: new Date().toISOString() });
    }

    tx.set(ref, {
      id_siswa: siswa.id,
      nama_siswa: siswa.nama,
      kelas: siswa.kelas || '',
      tahun_ajaran: cfg.tahunAjaran || '',
      total_poin: totalBaru,
      level_saat_ini: levelBaru.level,
      nama_level: levelBaru.nama,
      riwayat_level: riwayat,
      terakhir_diperbarui: serverTimestamp(),
    }, { merge: true });
  });
}

function tampilkanToast(pesan) {
  // pakai toast bawaan portal kalau ada, supaya konsisten dengan UI yang sudah ada
  if (typeof window.tampilToast === 'function') {
    window.tampilToast(pesan);
    return;
  }
  const el = document.getElementById('plgw-toast');
  el.textContent = pesan;
  el.classList.add('tampil');
  setTimeout(() => el.classList.remove('tampil'), 2500);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
