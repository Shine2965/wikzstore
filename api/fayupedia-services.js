// /api/fayupedia-services.js
// Vercel Serverless Function - Proxy ke Fayupedia API
// Support: 1. Ambil daftar layanan  2. Cek saldo

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const apiId = parseInt(process.env.FAYUPEDIA_API_ID) || 5522;
    const apiKey = process.env.FAYUPEDIA_API_KEY || 'qzysdo-hzbsqd-iz9ljh-8iozzn-rucfid';

    if (!apiKey) {
      return res.status(500).json({
        status: false,
        msg: 'Konfigurasi API belum lengkap (FAYUPEDIA_API_KEY missing)'
      });
    }

    // ===== DETECT ACTION =====
    // ?action=services (default) atau ?action=balance
    const action = (req.query && req.query.action) || 'services';

    // ============================================================
    // 🔥 ACTION: BALANCE (CEK SALDO)
    // ============================================================
    if (action === 'balance') {
      const balanceResponse = await fetch('https://fayupedia.id/api/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          api_id: apiId,
          api_key: apiKey
        })
      });

      if (!balanceResponse.ok) {
        const text = await balanceResponse.text().catch(() => '');
        console.error('Fayupedia balance HTTP error:', balanceResponse.status, text);
        return res.status(502).json({
          status: false,
          msg: `Gagal menghubungi provider (HTTP ${balanceResponse.status})`
        });
      }

      const balanceData = await balanceResponse.json();

      if (!balanceData.status) {
        return res.status(502).json({
          status: false,
          msg: balanceData.msg || 'Respon provider tidak valid'
        });
      }

      // Cache singkat
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');

      return res.status(200).json({
        status: true,
        msg: balanceData.msg || 'OK',
        balance: Number(balanceData.balance) || 0
      });
    }

    // ============================================================
    // 🔥 ACTION: SERVICES (DAFTAR LAYANAN)
    // ============================================================
    const servicesResponse = await fetch('https://fayupedia.id/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        api_id: apiId,
        api_key: apiKey
      })
    });

    if (!servicesResponse.ok) {
      const text = await servicesResponse.text().catch(() => '');
      console.error('Fayupedia services HTTP error:', servicesResponse.status, text);
      return res.status(502).json({
        status: false,
        msg: `Gagal menghubungi provider (HTTP ${servicesResponse.status})`
      });
    }

    const data = await servicesResponse.json();

    if (!data.status || !Array.isArray(data.services)) {
      console.error('Fayupedia response invalid:', data);
      return res.status(502).json({
        status: false,
        msg: data.msg || 'Respon provider tidak valid'
      });
    }

    // ===== GROUP BY CATEGORY + MARKUP 10% =====
    const grouped = {};
    const MARKUP = 1.058;

    for (const s of data.services) {
      const category = (s.category || 'Lainnya').trim() || 'Lainnya';
      if (!grouped[category]) {
        grouped[category] = [];
      }

      const type = (s.type || 'default').toLowerCase();
      const needsComment =
        type.includes('comment') ||
        type === 'custom_comment' ||
        type === 'comment_likes' ||
        type === 'comment_reply';

      const rawPrice = Number(s.price) || 0;
      const markedUpPrice = Math.round(rawPrice * MARKUP);

      grouped[category].push({
        id: s.id,
        name: s.name || `Service #${s.id}`,
        pricePerFollower: markedUpPrice,
        // 🔥 SIMPAN HARGA ASLI PROVIDER UNTUK CEK SALDO
        rawPricePerFollower: rawPrice,
        min: Number(s.min) || 1,
        max: Number(s.max) || 1000000,
        average: s.average || '-',
        desc: s.description || '',
        comment: needsComment,
        type: s.type || 'default',
        refill: s.refill === 1 || s.refill === true
      });
    }

    const sorted = {};
    Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'id'))
      .forEach((cat) => {
        sorted[cat] = grouped[cat].sort((a, b) =>
          String(a.name).localeCompare(String(b.name), 'id')
        );
      });

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    return res.status(200).json(sorted);

  } catch (error) {
    console.error('Error fayupedia-services:', error);
    return res.status(500).json({
      status: false,
      msg: 'Internal server error: ' + (error.message || '')
    });
  }
}
