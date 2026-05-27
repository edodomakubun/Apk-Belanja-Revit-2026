// Mempertahankan URL GAS yang lama
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyMH_x4PrdnEobJm3Bu1Q6XulFpDfGxzoDhrfH5ChRdHsOTikJdd5r6I_XNcPlwqCfW/exec'; 

// Format Rupiah
const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(angka);

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  
  // Fitur Kalkulasi Otomatis Total Belanja
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
});

// Registrasi Service Worker di aplikasi utama
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}

// --- AUTENTIKASI ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.innerText = 'Memeriksa...';
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
      // PERUBAHAN: Menggunakan localStorage agar sesi login tersimpan permanen
      localStorage.setItem('user', JSON.stringify(data.user));
      checkSession();
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  } finally {
    btn.innerText = 'Masuk';
    btn.disabled = false;
  }
});

function checkSession() {
  // PERUBAHAN: Memeriksa data user dari localStorage
  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    document.getElementById('loginView').classList.add('d-none');
    document.getElementById('mainNav').classList.remove('d-none');
    document.getElementById('appView').classList.remove('d-none');
    setupRoleUI(user);
    loadDashboard(user);
  } else {
    document.getElementById('loginView').classList.remove('d-none');
    document.getElementById('mainNav').classList.add('d-none');
    document.getElementById('appView').classList.add('d-none');
  }
}

function logout() {
  // PERUBAHAN: Menghapus data sesi dari localStorage saat user keluar
  localStorage.removeItem('user');
  location.reload();
}

// --- MANAJEMEN ROLE UI ---
function setupRoleUI(user) {
  const isPimpinan = (user.role === 'kepsek' || user.role === 'ops');
  
  // Menampilkan/menyembunyikan panel berdasarkan role
  document.getElementById('danaPanel').classList.toggle('d-none', !isPimpinan);
  document.getElementById('summaryKategori').classList.toggle('d-none', !isPimpinan);
  document.getElementById('detailTransaksiPanel').classList.toggle('d-none', !isPimpinan);
  document.getElementById('bendaharaPanel').classList.toggle('d-none', isPimpinan);
}

async function loadDashboard(user) {
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
        
        // Memanggil fungsi perenderan baru untuk Kepsek/Ops
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

// FUNGSI: Render Ringkasan Pengeluaran Per Kategori
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
            <small class="text-muted d-block">${kat}</small>
            <span class="fw-bold text-dark h6">${formatRp(total)}</span>
          </div>
        </div>
      </div>
    `;
  });
}

// FUNGSI: Render Detail Transaksi
function renderTabelDetail(transaksi) {
  const tbody = document.getElementById('tbodyTransaksi');
  tbody.innerHTML = '';
  
  if (transaksi.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Belum ada transaksi tercatat.</td></tr>';
    return;
  }

  transaksi.forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td><small>${item.tanggal}</small></td>
        <td><span class="badge bg-secondary">${item.kategori}</span></td>
        <td>
          ${item.barang} <br>
          <small class="text-muted">${item.qty} x ${formatRp(item.harga)}</small>
        </td>
        <td class="fw-bold text-success">${formatRp(item.total)}</td>
        <td>
          ${item.urlBarang ? `<a href="${item.urlBarang}" target="_blank" class="btn btn-sm btn-outline-primary mb-1"><i class="fa-solid fa-box"></i> Barang</a>` : ''}
          ${item.urlNota ? `<a href="${item.urlNota}" target="_blank" class="btn btn-sm btn-outline-info mb-1"><i class="fa-solid fa-receipt"></i> Nota</a>` : ''}
        </td>
      </tr>
    `;
  });
}

// --- KOMPRESI & UPLOAD TRANSAKSI ---
document.getElementById('transaksiForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = document.getElementById('btnSubmit');
  const statusTxt = document.getElementById('loadingStatus');
  btn.disabled = true;
  statusTxt.classList.remove('d-none');

  const fileBarang = document.getElementById('fotoBarang').files[0];
  const fileNota = document.getElementById('fotoNota').files[0];

  try {
    const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1280, useWebWorker: true };
    const compressedBarang = await imageCompression(fileBarang, options);
    const compressedNota = await imageCompression(fileNota, options);

    const base64Barang = await toBase64(compressedBarang);
    const base64Nota = await toBase64(compressedNota);

    // PERUBAHAN: Mengambil data kredensial user dari localStorage untuk dikirim ke backend
    const user = JSON.parse(localStorage.getItem('user'));

    const payload = {
      action: 'add_transaksi',
      idguru: user.idguru,
      kategori: document.getElementById('kategori').value,
      namaBarang: document.getElementById('namaBarang').value,
      qty: document.getElementById('qty').value,
      harga: document.getElementById('harga').value,
      fotoBarang: base64Barang,
      fotoNota: base64Nota
    };

    statusTxt.innerText = 'Mengirim data ke server...';
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();

    if (result.status === 'success') {
      alert('Transaksi berhasil disimpan!');
      e.target.reset();
      document.getElementById('totalOtomatis').value = 'Rp 0'; // Reset total kalkulasi
      loadDashboard(user); 
    } else {
      alert('Gagal: ' + result.message);
    }
  } catch (error) {
    console.error(error);
    alert('Terjadi kesalahan saat memproses gambar atau mengirim data.');
  } finally {
    btn.disabled = false;
    statusTxt.classList.add('d-none');
    statusTxt.innerText = 'Memproses dan mengompres foto... mohon tunggu.';
  }
});

// Helper: Convert File to Base64
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}