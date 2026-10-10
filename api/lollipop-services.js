// /api/lollipop-services.js
// All-in-one Lollipop SMM API handler
// Actions: balance | services | add | status | refill | profile

export default async function handler(req, res) {
    // ===== CORS =====
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({
            status: false,
            msg: 'Method not allowed. Use GET or POST'
        });
    }

    try {
        // ===== API KEY =====
        const apiKey = process.env.LOLLIPOP_API_KEY || 'c47e089951a45fe498453db07e429124';

        if (!apiKey) {
            console.error('❌ LOLLIPOP_API_KEY tidak ditemukan di environment');
            return res.status(500).json({
                status: false,
                msg: 'Konfigurasi API belum lengkap (LOLLIPOP_API_KEY missing)'
            });
        }

        // ===== ENDPOINT LOLLIPOP =====
        const LOLLIPOP_ENDPOINT = 'https://lollipop-smm.com/api/v2';

        // ===== AMBIL ACTION DARI QUERY ATAU BODY =====
        let body = {};
        if (req.method === 'POST') {
            body = req.body || {};
            // Vercel kadang kirim string body
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
        }

        const action = String(
            body.action ||
            req.query.action ||
            req.query.a ||
            ''
        ).toLowerCase().trim();

        // =========================================================
        // ===== ACTION: BALANCE =====
        // =========================================================
        if (action === 'balance') {
            const r = await fetch(LOLLIPOP_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ key: apiKey, action: 'balance' })
            }).catch(() => null);

            if (!r || !r.ok) {
                return res.status(502).json({
                    status: false,
                    msg: 'Gagal menghubungi provider Lollipop (balance)'
                });
            }

            const data = await r.json().catch(() => null);
            const balance = data && data.balance ? parseFloat(data.balance) || 0 : 0;

            return res.status(200).json({
                status: true,
                balance
            });
        }

        // =========================================================
        // ===== ACTION: SERVICES (default, kalo action kosong) =====
        // =========================================================
        if (!action || action === 'services' || action === 'service') {
            const [resBalance, resServices] = await Promise.all([
                fetch(LOLLIPOP_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ key: apiKey, action: 'balance' })
                }).catch(() => null),
                fetch(LOLLIPOP_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ key: apiKey, action: 'services' })
                }).catch(() => null)
            ]);

            // Parse balance
            let userBalance = 0;
            if (resBalance && resBalance.ok) {
                const balanceData = await resBalance.json().catch(() => null);
                if (balanceData && balanceData.balance) {
                    userBalance = parseFloat(balanceData.balance) || 0;
                }
            }

            // Parse services
            if (!resServices || !resServices.ok) {
                const text = resServices ? await resServices.text().catch(() => '') : '';
                console.error('❌ Lollipop API HTTP error:', resServices?.status, text);
                return res.status(502).json({
                    status: false,
                    msg: 'Gagal menghubungi provider Lollipop'
                });
            }

            const data = await resServices.json();

            if (!Array.isArray(data)) {
                console.error('❌ Lollipop response invalid:', data);
                return res.status(502).json({
                    status: false,
                    msg: 'Respon provider tidak valid'
                });
            }

            // ===== GROUP BY CATEGORY + MARKUP =====
            const grouped = {};
            const MARKUP = 1.15; // 10% markup

            for (const s of data) {
                const category = (s.category || 'Lainnya').trim() || 'Lainnya';
                if (!grouped[category]) {
                    grouped[category] = [];
                }

                const type = (s.type || 'default').toLowerCase();
                const name = (s.name || '').toLowerCase();
                const needsComment =
                    type.includes('comment') ||
                    type === 'custom_comment' ||
                    type === 'comment_likes' ||
                    type === 'comment_reply' ||
                    name.includes('comment') ||
                    name.includes('komentar') ||
                    name.includes('custom');

                const rawPrice = Number(s.rate) || 0;
                const markedUpPrice = Math.round(rawPrice * MARKUP);

                grouped[category].push({
                    id: s.service,
                    name: s.name || `Service #${s.service}`,
                    pricePerFollower: markedUpPrice,
                    rawRate: rawPrice,
                    diskon: null,
                    min: Number(s.min) || 1,
                    max: Number(s.max) || 1000000,
                    average: '-',
                    desc: '',
                    comment: needsComment,
                    type: s.type || 'default',
                    refill: s.refill === true || s.refill === 1,
                    rate: s.rate || 0
                });
            }

            // ===== URUTKAN =====
            const sortedServices = {};
            Object.keys(grouped)
                .sort((a, b) => a.localeCompare(b, 'id'))
                .forEach((cat) => {
                    sortedServices[cat] = grouped[cat].sort((a, b) =>
                        String(a.name).localeCompare(String(b.name), 'id')
                    );
                });

            res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

            return res.status(200).json({
                status: true,
                balance: userBalance,
                services: sortedServices
            });
        }

        // =========================================================
        // ===== ACTION: ADD (ORDER) =====
        // =========================================================
        if (action === 'add' || action === 'order') {
            const service = body.service || req.query.service;
            const link = body.link || body.target || req.query.link || req.query.target;
            const quantity = body.quantity || body.jumlah || req.query.quantity || req.query.jumlah;
            const comments = body.comments || body.comment || req.query.comments || req.query.comment;

            // ===== VALIDASI =====
            if (!service) {
                return res.status(400).json({
                    status: false,
                    msg: 'Parameter "service" wajib diisi'
                });
            }
            if (!link) {
                return res.status(400).json({
                    status: false,
                    msg: 'Parameter "link" wajib diisi'
                });
            }
            if (!quantity) {
                return res.status(400).json({
                    status: false,
                    msg: 'Parameter "quantity" wajib diisi'
                });
            }

            // ===== BUILD PAYLOAD =====
            const orderPayload = {
                key: apiKey,
                action: 'add',
                service: parseInt(service, 10),
                link: String(link).trim(),
                quantity: parseInt(quantity, 10)
            };

            // Handle comments (kalau ada)
            if (comments && String(comments).trim() !== '') {
                orderPayload.comments = String(comments)
                    .split('\n')
                    .map(l => l.trim())
                    .filter(Boolean)
                    .join('\n');
            }

            // ===== SEND ORDER =====
            const r = await fetch(LOLLIPOP_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(orderPayload)
            }).catch(() => null);

            if (!r || !r.ok) {
                const text = r ? await r.text().catch(() => '') : '';
                console.error('❌ Lollipop order HTTP error:', r?.status, text);
                return res.status(502).json({
                    status: false,
                    msg: 'Gagal menghubungi provider Lollipop (order)',
                    error: text
                });
            }

            const data = await r.json().catch(() => null);

            if (!data) {
                return res.status(502).json({
                    status: false,
                    msg: 'Respon provider tidak valid (order)'
                });
            }

            // ===== FORWARD RESPONSE =====
            // Standard SMM panel: { order: 12345 } atau { error: "..." }
            // Kita forward apa adanya biar frontend gampang extract
            return res.status(200).json(data);
        }

        // =========================================================
        // ===== ACTION: STATUS =====
        // =========================================================
        if (action === 'status') {
            const orderId = body.order || body.order_id || req.query.order || req.query.order_id;

            if (!orderId) {
                return res.status(400).json({
                    status: false,
                    msg: 'Parameter "order" wajib diisi untuk cek status'
                });
            }

            const r = await fetch(LOLLIPOP_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    key: apiKey,
                    action: 'status',
                    order: parseInt(orderId, 10)
                })
            }).catch(() => null);

            if (!r || !r.ok) {
                return res.status(502).json({
                    status: false,
                    msg: 'Gagal menghubungi provider Lollipop (status)'
                });
            }

            const data = await r.json().catch(() => null);
            return res.status(200).json(data || { status: false, msg: 'Empty response' });
        }

        // =========================================================
        // ===== ACTION: REFILL =====
        // =========================================================
        if (action === 'refill') {
            const orderId = body.order || body.order_id || req.query.order || req.query.order_id;

            if (!orderId) {
                return res.status(400).json({
                    status: false,
                    msg: 'Parameter "order" wajib diisi untuk refill'
                });
            }

            const r = await fetch(LOLLIPOP_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    key: apiKey,
                    action: 'refill',
                    order: parseInt(orderId, 10)
                })
            }).catch(() => null);

            if (!r || !r.ok) {
                return res.status(502).json({
                    status: false,
                    msg: 'Gagal menghubungi provider Lollipop (refill)'
                });
            }

            const data = await r.json().catch(() => null);
            return res.status(200).json(data || { status: false, msg: 'Empty response' });
        }

        // =========================================================
        // ===== ACTION: PROFILE =====
        // =========================================================
        if (action === 'profile') {
            const r = await fetch(LOLLIPOP_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ key: apiKey, action: 'profile' })
            }).catch(() => null);

            if (!r || !r.ok) {
                return res.status(502).json({
                    status: false,
                    msg: 'Gagal menghubungi provider Lollipop (profile)'
                });
            }

            const data = await r.json().catch(() => null);
            return res.status(200).json(data || { status: false, msg: 'Empty response' });
        }

        // =========================================================
        // ===== ACTION TIDAK DIKENALI =====
        // =========================================================
        return res.status(400).json({
            status: false,
            msg: 'Action tidak dikenali. Gunakan: balance | services | add | status | refill | profile'
        });

    } catch (error) {
        console.error('❌ Error lollipop-services:', error);
        return res.status(500).json({
            status: false,
            msg: 'Internal server error: ' + (error.message || '')
        });
    }
}
