const GAS_URL = 'https://script.google.com/macros/s/AKfycbyMH_x4PrdnEobJm3Bu1Q6XulFpDfGxzoDhrfH5ChRdHsOTikJdd5r6I_XNcPlwqCfW/exec'; 

const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  initApp();
  initDB();
  
  // Kalkulasi Otomatis
  const inputQty = document.getElementById('qty');
  const inputHarga = document.getElementById('harga');
  const totalDisplay = document.getElementById('totalOtomatis');

  const hitungTotal = () => {
    const q = parseFloat(inputQty.value) || 0;
    const h = parseFloat(inputHarga.value) || 0;
    totalDisplay.value = formatRp(q * h);
  };

  inputQty.addEventListener('input', hitungTotal);
  inputHarga.addEventListener('input', hitungTotal);

  // Online/Offline Listener
  window.addEventListener('online', checkPendingSync);
  window.addEventListener('offline', () => console.log('Offline mode active.'));
});

// Registrasi Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW Register Error:', err));
  });
}

// --- ROUTER ---
function initRouter() {
  const handleRoute = () => {
    const hash = window.location.hash || '#dashboard';
    const user = JSON.parse(localStorage.getItem('user'));

    if (!user && hash !== '#login') {
      window.location.hash = '#login';
      return;
    }

    if (user && hash === '#login') {
      window.location.hash = '#dashboard';
      return;
    }

    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('d-none'));
    document.getElementById('loginView').classList.add('d-none');
    document.getElementById('mainNav').classList.add('d-none');

    // Show current page
    if (hash === '#login') {
      document.getElementById('loginView').classList.remove('d-none');
    } else {
      document.getElementById('mainNav').classList.remove('d-none');
      if (hash === '#dashboard') {
        document.getElementById('dashboardView').classList.remove('d-none');
        loadDashboard(user);
      } else if (hash === '#input') {
        document.getElementById('inputView').classList.remove('d-none');
      }

      // Update Active Nav Link
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === hash);
      });
    }
  };

  window.addEventListener('hashchange', handleRoute);
  handleRoute(); // Initial check
}

function initApp() {
  // Login Form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Memeriksa...';
    btn.disabled = true;

    const payload = {
      action: 'login',
      idguru: document.getElementById('idguru').value,
      pin: document.getElementById('pin').value
    };

    try {
      const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();

      if (data.status === 'success') {
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.hash = '#dashboard';
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });

  // Transaksi Form
  document.getElementById('transaksiForm').addEventListener('submit', handleTransaksiSubmit);
}

function logout() {
  if (confirm('Apakah Anda yakin ingin keluar?')) {
    localStorage.removeItem('user');
    window.location.hash = '#login';
  }
}

// --- DATABASE (IndexedDB) ---
let db;
function initDB() {
  const request = indexedDB.open('BRevitDB', 1);
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('pendingTransactions')) {
      db.createObjectStore('pendingTransactions', { keyPath: 'id', autoIncrement: true });
    }
  };
  request.onsuccess = (e) => {
    db = e.target.result;
    checkPendingSync();
  };
}

// --- DASHBOARD ---
async function loadDashboard(user) {
  setupRoleUI(user);
  const payload = { action: 'get_dashboard', role: user.role, idguru: user.idguru };
  
  try {
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    
    if (data.status === 'success') {
      const info = data.data;
      if (user.role === 'kepsek' || user.role === 'ops') {
        document.getElementById('txtTotalDana').innerText = formatRp(info.totalDana);
        document.getElementById('txtPengeluaran').innerText = formatRp(info.totalPengeluaran);
        document.getElementById('txtSisa').innerText = formatRp(info.sisaDana);
        renderSummaryKategori(info.transaksi);
        renderTabelDetail(info.transaksi);
      } else {
        document.getElementById('txtPengeluaranBendahara').innerText = formatRp(info.totalPengeluaran);
      }
    }
  } catch (error) {
    console.error('Gagal mengambil data dashboard', error);
  }
}

function setupRoleUI(user) {
  const isPimpinan = (user.role === 'kepsek' || user.role === 'ops');
  document.getElementById('danaPanel').classList.toggle('d-none', !isPimpinan);
  document.getElementById('summaryKategori').classList.toggle('d-none', !isPimpinan);
  document.getElementById('detailTransaksiPanel').classList.toggle('d-none', !isPimpinan);
  document.getElementById('bendaharaPanel').classList.toggle('d-none', isPimpinan);
}

function renderSummaryKategori(transaksi) {
  const grouped = transaksi.reduce((acc, curr) => {
    acc[curr.kategori] = (acc[curr.kategori] || 0) + parseFloat(curr.total);
    return acc;
  }, {});

  const listContainer = document.getElementById('listKategori');
  listContainer.innerHTML = '';
  
  Object.entries(grouped).forEach(([kat, total]) => {
    listContainer.innerHTML += `
      <div class="col-md-3">
        <div class="card border-0 bg-white shadow-sm h-100">
          <div class="card-body py-3">
            <small class="text-muted d-block mb-1 text-uppercase fw-bold" style="font-size: 0.65rem;">${kat}</small>
            <span class="fw-bold text-dark h6 mb-0">${formatRp(total)}</span>
          </div>
        </div>
      </div>
    `;
  });
}

function renderTabelDetail(transaksi) {
  const tbody = document.getElementById('tbodyTransaksi');
  tbody.innerHTML = '';
  
  if (transaksi.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted small">Belum ada transaksi tercatat.</td></tr>';
    return;
  }

  transaksi.forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td><div class="small fw-bold">${item.tanggal}</div></td>
        <td><span class="badge bg-light text-dark border">${item.kategori}</span></td>
        <td>
          <div class="fw-bold">${item.barang}</div>
          <small class="text-muted">${item.qty} x ${formatRp(item.harga)}</small>
        </td>
        <td class="fw-bold text-primary">${formatRp(item.total)}</td>
        <td>
          <div class="btn-group">
            ${item.urlBarang ? `<a href="${item.urlBarang}" target="_blank" class="btn btn-sm btn-outline-primary" title="Lihat Barang"><i class="fa-solid fa-box"></i></a>` : ''}
            ${item.urlNota ? `<a href="${item.urlNota}" target="_blank" class="btn btn-sm btn-outline-info" title="Lihat Nota"><i class="fa-solid fa-receipt"></i></a>` : ''}
          </div>
        </td>
      </tr>
    `;
  });
}

// --- TRANSAKSI LOGIC ---
async function handleTransaksiSubmit(e) {
  e.preventDefault();
  
  const btn = document.getElementById('btnSubmit');
  const statusTxt = document.getElementById('loadingStatus');
  const statusMsg = document.getElementById('statusMessage');

  btn.disabled = true;
  statusTxt.classList.remove('d-none');
  statusMsg.innerText = 'Kompresi gambar...';

  const fileBarang = document.getElementById('fotoBarang').files[0];
  const fileNota = document.getElementById('fotoNota').files[0];

  try {
    const options = { maxSizeMB: 0.7, maxWidthOrHeight: 1280, useWebWorker: true };
    const compressedBarang = await imageCompression(fileBarang, options);
    const compressedNota = await imageCompression(fileNota, options);

    const base64Barang = await toBase64(compressedBarang);
    const base64Nota = await toBase64(compressedNota);

    const user = JSON.parse(localStorage.getItem('user'));
    const timestamp = new Date().toISOString(); // Waktu saat pertama kali diupload (lokal)

    const payload = {
      action: 'add_transaksi',
      idguru: user.idguru,
      kategori: document.getElementById('kategori').value,
      namaBarang: document.getElementById('namaBarang').value,
      qty: document.getElementById('qty').value,
      harga: document.getElementById('harga').value,
      fotoBarang: base64Barang,
      fotoNota: base64Nota,
      timestamp: timestamp
    };

    if (navigator.onLine) {
      statusMsg.innerText = 'Mengirim data...';
      const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
      const result = await res.json();

      if (result.status === 'success') {
        alert('Transaksi berhasil disimpan!');
        resetForm();
        window.location.hash = '#dashboard';
      } else {
        throw new Error(result.message);
      }
    } else {
      // Offline mode: Simpan ke IndexedDB
      await saveToIndexedDB(payload);
      alert('Koneksi tidak tersedia. Transaksi disimpan secara lokal dan akan diunggah otomatis saat Anda online.');
      resetForm();
      window.location.hash = '#dashboard';
    }
  } catch (error) {
    console.error(error);
    alert('Terjadi kesalahan: ' + error.message);
  } finally {
    btn.disabled = false;
    statusTxt.classList.add('d-none');
  }
}

function resetForm() {
  document.getElementById('transaksiForm').reset();
  document.getElementById('totalOtomatis').value = 'Rp 0';
}

// --- SYNC & OFFLINE HELPERS ---
async function saveToIndexedDB(data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingTransactions'], 'readwrite');
    const store = transaction.objectStore('pendingTransactions');
    const request = store.add(data);
    request.onsuccess = () => {
      checkPendingSync();
      resolve();
    };
    request.onerror = () => reject('Gagal menyimpan offline');
  });
}

async function checkPendingSync() {
  if (!db) return;
  const transaction = db.transaction(['pendingTransactions'], 'readonly');
  const store = transaction.objectStore('pendingTransactions');
  const request = store.getAll();

  request.onsuccess = async () => {
    const pending = request.result;
    const badge = document.getElementById('syncStatus');
    const countTxt = document.getElementById('syncCount');

    if (pending.length > 0) {
      badge.classList.remove('d-none');
      countTxt.innerText = pending.length;

      if (navigator.onLine) {
        processSync(pending);
      }
    } else {
      badge.classList.add('d-none');
    }
  };
}

async function processSync(pending) {
  for (const data of pending) {
    try {
      const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(data) });
      const result = await res.json();
      if (result.status === 'success') {
        // Hapus dari IDB jika sukses
        const tx = db.transaction(['pendingTransactions'], 'readwrite');
        tx.objectStore('pendingTransactions').delete(data.id);
      }
    } catch (e) {
      console.warn('Sync failed for item', data.id, e);
      break; // Berhenti jika satu gagal (mungkin koneksi hilang lagi)
    }
  }
  checkPendingSync();
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}
