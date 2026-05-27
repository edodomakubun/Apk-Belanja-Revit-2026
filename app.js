// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxidUtcc_xzVoo0ErIoopZuu8p8hjqWUmqPzBrv89-SHC5nOKczefX0d-Kft-CfLDHS/exec'; 

// Format Rupiah
const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(angka);

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});

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
      sessionStorage.setItem('user', JSON.stringify(data.user));
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
  const user = JSON.parse(sessionStorage.getItem('user'));
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
  sessionStorage.removeItem('user');
  location.reload();
}

// --- MANAJEMEN ROLE UI ---
function setupRoleUI(user) {
  if (user.role === 'kepsek' || user.role === 'ops') {
    document.getElementById('danaPanel').classList.remove('d-none');
    document.getElementById('bendaharaPanel').classList.add('d-none');
  } else if (user.role === 'bendahara') {
    document.getElementById('danaPanel').classList.add('d-none');
    document.getElementById('bendaharaPanel').classList.remove('d-none');
  }
}

async function loadDashboard(user) {
  const payload = { action: 'get_dashboard', role: user.role, idguru: user.idguru };
  const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
  const data = await res.json();
  
  if (data.status === 'success') {
    if (user.role === 'kepsek' || user.role === 'ops') {
      document.getElementById('txtTotalDana').innerText = formatRp(data.data.totalDana);
      document.getElementById('txtPengeluaran').innerText = formatRp(data.data.totalPengeluaran);
      document.getElementById('txtSisa').innerText = formatRp(data.data.sisaDana);
    } else {
      document.getElementById('txtPengeluaranBendahara').innerText = formatRp(data.data.totalPengeluaran);
    }
  }
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
    // 1. Kompresi gambar client-side (< 1MB)
    const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1280, useWebWorker: true };
    const compressedBarang = await imageCompression(fileBarang, options);
    const compressedNota = await imageCompression(fileNota, options);

    // 2. Konversi ke Base64
    const base64Barang = await toBase64(compressedBarang);
    const base64Nota = await toBase64(compressedNota);

    const user = JSON.parse(sessionStorage.getItem('user'));

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

    // 3. Kirim ke GAS
    statusTxt.innerText = 'Mengirim data ke server...';
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();

    if (result.status === 'success') {
      alert('Transaksi berhasil disimpan!');
      e.target.reset();
      loadDashboard(user); // refresh data angka
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