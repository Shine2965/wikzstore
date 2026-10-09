// /api/qris-config.js
// Vercel Serverless Function - Mengambil semua konfigurasi dari Environment Variable

export default function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        // ===== QIOSPAY CONFIG =====
        const qiospayApiKey = process.env.QIOSPAY_API_KEY || '3b44218e0fddd55b592fc57fa2773ae18982478f568eefcf1cd3f4104132fad8';
        const merchantCode = process.env.QIOSPAY_MERCHANT_CODE || 'QP052692';

        // ===== INDOSMM CONFIG =====
        const indoApiKey = process.env.INDO_API_KEY || '4ed44f3cf37683ca04b27636f4a66ca5';

        // ===== ORDER SOSMED CONFIG (LEGACY) =====
        const orderApiId = parseInt(process.env.ORDER_API_ID || process.env.ORDERSOSMED_API_ID) || 11313;
        const orderApiKey = process.env.ORDER_API_KEY || process.env.ORDERSOSMED_API_KEY || '23941803d5391da4e45a1bf4ebca52064fa17a53574d1c3655a0173dd7530fb1';
        const orderSecretKey = process.env.ORDER_SECRET_KEY || process.env.ORDERSOSMED_SECRET_KEY || 'Alvino11';

        // ===== FAYUPEDIA CONFIG (TETAP ADA) =====
        const fayupediaApiKey = process.env.FAYUPEDIA_API_KEY || 'vxiho0-tldcsq-ouqra0-flb3km-3hlczy';
        const fayupediaApiId = parseInt(process.env.FAYUPEDIA_API_ID) || 287358;

        // ===== IRVANKARDE CONFIG =====
        const irvankardeApiKey = process.env.IRVANKARDE_API_KEY || '';
        const irvankardeApiId = parseInt(process.env.IRVANKARDE_API_ID) || 81074;

        // ===== LOLLIPOP CONFIG =====
        const lollipopApiKey = process.env.LOLLIPOP_API_KEY || '8c2ed537ebc1125e55be03cf722a8e0b';

        // ===== RESPONSE =====
        return res.status(200).json({
            success: true,
            qiospay_api_key: qiospayApiKey,
            merchant_code: merchantCode,

            // ===== INDOSMM =====
            indo_api_key: indoApiKey,

            // ===== LEGACY ORDER SOSMED =====
            order_api_id: orderApiId,

            // ===== FAYUPEDIA =====
            fayupedia_api_key: fayupediaApiKey,
            fayupedia_api_id: fayupediaApiId,

            // ===== IRVANKARDE =====
            irvankarde_api_key: irvankardeApiKey,
            irvankarde_api_id: irvankardeApiId,

            // ===== LOLLIPOP =====
            lollipop_api_key: lollipopApiKey,

            from_env: {
                qiospay: !!process.env.QIOSPAY_API_KEY,
                indo: !!process.env.INDO_API_KEY,
                order: !!(process.env.ORDER_API_KEY || process.env.ORDERSOSMED_API_KEY),
                fayupedia: !!process.env.FAYUPEDIA_API_KEY,
                irvankarde: !!process.env.IRVANKARDE_API_KEY,
                lollipop: !!process.env.LOLLIPOP_API_KEY
            }
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}
