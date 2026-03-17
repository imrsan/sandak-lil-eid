'use strict';

// generate.js — Gemini nano-banana 2 (gemini-2.5-flash-image)
// يدعم: توليد من نص فقط + توليد مع صورة شخص مضمّنة

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '' };

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    console.error('GEMINI_API_KEY not set');
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'تعذّر إنشاء الصورة. يرجى المحاولة لاحقاً.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'طلب غير صالح' }) }; }

  const { prompt, size = 'sq', personImageBase64, personMimeType = 'image/jpeg' } = body;
  if (!prompt) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'تعذّر إنشاء الصورة' }) };

  // تحديد الأبعاد
  const aspectMap = { sq: '1:1', st: '9:16', cd: '16:9' };
  const aspect = aspectMap[size] || '1:1';

  // بناء البرومبت المحسّن
  const enhancedPrompt = personImageBase64
    ? `Place the person from the uploaded photo naturally into this scene: ${prompt}. 
       The person should look natural and realistic in the scene, maintaining their exact appearance, face, and clothing.
       The lighting and style should match the scene. High quality, photorealistic, cinematic.`
    : `${prompt}. No text, no watermark, no words in the image.`;

  // بناء الطلب لـ Gemini
  const parts = [];

  // إضافة صورة الشخص إذا وُجدت
  if (personImageBase64) {
    parts.push({
      inline_data: {
        mime_type: personMimeType,
        data: personImageBase64,
      }
    });
  }

  // إضافة البرومبت النصي
  parts.push({ text: enhancedPrompt });

  const requestBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 1.0,
    },
  };

  try {
    const model = 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Gemini API error:', res.status, errText.slice(0, 300));
      if (res.status === 400) return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'تعذّر معالجة الطلب. يرجى تجربة ثيم مختلف.' }) };
      if (res.status === 429) return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'الخادم مشغول. يرجى الانتظار ثم المحاولة.' }) };
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'تعذّر إنشاء الصورة. يرجى المحاولة مجدداً.' }) };
    }

    const result = await res.json();
    
    // استخراج الصورة من الاستجابة
    const candidates = result?.candidates || [];
    let imageData = null;
    let imageMime = 'image/png';

    for (const candidate of candidates) {
      const parts = candidate?.content?.parts || [];
      for (const part of parts) {
        if (part.inline_data?.mime_type?.startsWith('image/')) {
          imageData = part.inline_data.data;
          imageMime = part.inline_data.mime_type;
          break;
        }
      }
      if (imageData) break;
    }

    if (!imageData) {
      console.error('No image in Gemini response:', JSON.stringify(result).slice(0, 300));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'لم تُنشأ الصورة. يرجى تجربة ثيم مختلف.' }) };
    }

    // إرجاع الصورة كـ data URL
    const imageUrl = `data:${imageMime};base64,${imageData}`;
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ imageUrl }),
    };

  } catch (err) {
    console.error('Network error:', err.message);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'تعذّر الاتصال. تحقق من الإنترنت وأعد المحاولة.' }) };
  }
};
