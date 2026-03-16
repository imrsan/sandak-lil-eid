'use strict';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '' };

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return {
    statusCode: 500, headers: CORS,
    body: JSON.stringify({ error: 'مفتاح FAL غير موجود في الإعدادات' })
  };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'طلب غير صالح' }) }; }

  const { prompt, size = 'sq', seed } = body;
  if (!prompt) return {
    statusCode: 400, headers: CORS,
    body: JSON.stringify({ error: 'لا يوجد برومبت للصورة' })
  };

  const SIZE_MAP = { sq: 'square_hd', st: 'portrait_16_9', cd: 'landscape_4_3' };
  const imageSize = SIZE_MAP[size] || 'square_hd';
  const randomSeed = seed || Math.floor(Math.random() * 9999999);

  try {
    const falResponse = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': 'Key ' + FAL_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        image_size: imageSize,
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: false,
        sync_mode: true,
        seed: randomSeed,
      }),
    });

    if (!falResponse.ok) {
      const errText = await falResponse.text().catch(() => '');
      console.error('FAL API error:', falResponse.status, errText.slice(0, 300));
      let msg = 'فشل طلب التوليد من FAL';
      if (falResponse.status === 401) msg = 'مفتاح FAL غير صحيح';
      if (falResponse.status === 402) msg = 'رصيد FAL نفد';
      if (falResponse.status === 503) msg = 'خادم FAL مشغول — أعد المحاولة';
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: msg }) };
    }

    const result = await falResponse.json();
    const imageUrl = result?.images?.[0]?.url;

    if (!imageUrl) {
      console.error('FAL response has no image URL:', JSON.stringify(result).slice(0, 200));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'لم تُستلم الصورة من FAL' }) };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ imageUrl, seed: randomSeed }),
    };

  } catch (err) {
    console.error('Network error calling FAL:', err.message);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ error: 'خطأ في الاتصال بـ FAL: ' + err.message }),
    };
  }
};
