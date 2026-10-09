// api/balance.js

const API_URL = 'https://fayupedia.id/api/balance';
const API_ID = 5522;
const API_KEY = '6mnjom-ing8mx-a4csgp-6bwv4c-4zdv1l';

/**
 * Format angka menjadi Rupiah Indonesia
 * @param {number} angka
 * @returns {string}
 */
function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(angka);
}

/**
 * Cek saldo dari endpoint Fayupedia
 * @returns {Promise<{status: boolean, msg: string, balance?: number}>}
 */
async function cekSaldoAPI() {
  const formData = new FormData();
  formData.append('api_id', API_ID);
  formData.append('api_key', API_KEY);

  const response = await fetch(API_URL, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Handler untuk tombol Cek Saldo
 * Dipanggil dari HTML: onclick="cekSaldo()"
 */
async function cekSaldo() {
  const btn = document.getElementById('btnCek');
  const result = document.getElementById('result');

  if (!btn || !result) {
    console.error('Element #btnCek atau #result tidak ditemukan');
    return;
  }

  // Loading state
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Memeriksa...';
  result.className = 'result';
  result.style.display = 'none';

  try {
    const data = await cekSaldoAPI();

    if (data.status === true) {
      result.className = 'result success';
      result.innerHTML = `
        <div class="label">Saldo Anda</div>
        <div class="balance">${formatRupiah(data.balance)}</div>
        <div style="margin-top:8px;font-size:0.8rem;color:#86efac;">${data.msg || 'OK'}</div>
      `;
    } else {
      result.className = 'result error';
      result.innerHTML = `
        <div class="label">Gagal</div>
        <div class="msg">${data.msg || 'Terjadi kesalahan'}</div>
      `;
    }
  } catch (err) {
    result.className = 'result error';
    result.innerHTML = `
      <div class="label">Error</div>
      <div class="msg">${err.message || 'Gagal menghubungi server'}</div>
    `;
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Cek Saldo Sekarang';
  }
}

// Export jika dipakai sebagai module
// export { cekSaldo, cekSaldoAPI, formatRupiah };
