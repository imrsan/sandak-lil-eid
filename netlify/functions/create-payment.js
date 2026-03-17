'use strict';
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// MyFatoorah Jordan endpoint
const MF_BASE = 'https://jordan.myfatoorah.com';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '' };

  const MF_KEY = process.env.MF_API_KEY;
  if (!MF_KEY) {
    console.error('MF_API_KEY not set');
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'تعذّر فتح بوابة الدفع. يرجى المحاولة لاحقاً.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'طلب غير صالح' }) }; }

  const redirectUrl = body.redirectUrl || 'https://glittering-axolotl-47968b.netlify.app/?payment=success';

  try {
    // الخطوة 1: الحصول على طرق الدفع المتاحة
    const initRes = await fetch(MF_BASE + '/v2/InitiatePayment', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MF_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ InvoiceAmount: 2, CurrencyIso: 'JOD' }),
    });

    const initData = await initRes.json();

    if (!initData.IsSuccess) {
      console.error('MF InitiatePayment failed:', JSON.stringify(initData).slice(0, 300));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'تعذّر فتح بوابة الدفع. يرجى المحاولة لاحقاً.' }) };
    }

    const methods = initData.Data?.PaymentMethods || [];
    if (!methods.length) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'لا توجد طرق دفع متاحة حالياً.' }) };
    }

    // اختيار أفضل طريقة دفع متاحة
    const method = methods.find(m => m.PaymentMethodCode === 'kn') ||
                   methods.find(m => m.PaymentMethodEn?.toLowerCase().includes('card')) ||
                   methods[0];

    // الخطوة 2: تنفيذ الدفع
    const execRes = await fetch(MF_BASE + '/v2/ExecutePayment', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MF_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        PaymentMethodId: method.PaymentMethodId,
        CustomerName: 'Sandak Eid',
        DisplayCurrencyIso: 'JOD',
        MobileCountryCode: '+962',
        CustomerMobile: '0790000000',
        CustomerEmail: 'customer@sandakeid.com',
        InvoiceValue: 2,
        CallBackUrl: redirectUrl,
        ErrorUrl: redirectUrl.replace('success', 'error'),
        Language: 'ar',
        CustomerReference: 'sandak_' + Date.now(),
        UserDefinedField: '5credits',
        InvoiceItems: [{ ItemName: 'سندك للعيد — 5 تهنئات', Quantity: 1, UnitPrice: 2 }],
      }),
    });

    const execData = await execRes.json();

    if (!execData.IsSuccess || !execData.Data?.PaymentURL) {
      console.error('MF ExecutePayment failed:', JSON.stringify(execData).slice(0, 300));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'تعذّر إنشاء رابط الدفع. يرجى المحاولة لاحقاً.' }) };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        paymentUrl: execData.Data.PaymentURL,
        invoiceId: execData.Data.InvoiceId,
      }),
    };

  } catch (err) {
    console.error('Payment error:', err.message);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'تعذّر الاتصال ببوابة الدفع. يرجى المحاولة لاحقاً.' }) };
  }
};
