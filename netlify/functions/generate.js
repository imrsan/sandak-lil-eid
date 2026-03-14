// netlify/functions/generate.js
const STYLE_PROMPTS = {
  classic: {
    prompt: 'Transform this photo into an elegant Eid al-Fitr greeting card. Style: luxury Islamic art with gold Arabic calligraphy, crescent moon and stars on deep navy background, intricate geometric patterns, soft warm glow. The person should remain recognizable as the centerpiece. Professional digital art, cinematic lighting, 4K quality.',
    negative: 'cartoon, anime, distorted face, text errors, blurry, low quality, overexposed',
  },
  golden: {
    prompt: 'Transform this photo into a radiant golden Eid greeting. Style: lush golden light beams, ornate arabesque patterns, glowing Eid lanterns, the person bathed in warm golden sunlight. Premium festive atmosphere, luxury aesthetic, bokeh background. Ultra HD.',
    negative: 'dark, gloomy, distorted, ugly, text errors, blurry',
  },
  floral: {
    prompt: 'Transform this photo into a beautiful Eid Mubarak floral greeting. Style: jasmine and rose petals in soft pastel tones, delicate arabesque florals, watercolor Islamic art, person surrounded by blooming flowers and soft lights. Elegant and serene.',
    negative: 'harsh colors, ugly, distorted face, blurry, text errors',
  },
  geometric: {
    prompt: 'Transform this photo into modern Eid geometric art. Style: precise Islamic tessellation patterns, deep purple and gold palette, clean contemporary Arabic design, person integrated as focal point within a beautiful geometric frame. Minimal and sophisticated.',
    negative: 'cluttered, messy, ugly, distorted, blurry, text errors',
  },
  nature: {
    prompt: 'Transform this photo into a peaceful Eid celebration scene. Style: lush green garden with hanging lanterns, crescent moon over palm trees, warm amber evening light, soft bokeh. Person shown in serene outdoor celebration setting. Cinematic quality.',
    negative: 'ugly, distorted, harsh, blurry, text errors, dark',
  },
  festive: {
    prompt: 'Transform this photo into a joyful Eid celebration. Style: colorful fireworks sky, festive lights and confetti, vibrant Arabian night atmosphere, person celebrated with golden sparkles. Happy and vibrant festive mood, premium quality.',
    negative: 'dark, sad, ugly, distorted, blurry, text errors',
  },
};

const rateLimitMap = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_IP || '5');
const RATE_WINDOW = parseInt(process.env.RATE_WINDOW_MS || '600000');

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = rateLimitMap.get(ip);
  if (!rec || now - rec.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (rec.count >= RATE_LIMIT) return false;
  rec.count++;
  return true;
}

exports.handler = async (event) => {
  const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: 'تجاوزت الحد المسموح من الطلبات. يرجى الانتظار 10 دقائق ثم المحاولة مجدداً.' }) };
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'الخدمة غير مهيأة.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'طلب غير صالح' }) }; }

  const { imageBase64, style, greeting = '', name = '' } = body;
  if (!imageBase64) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'لم يتم إرسال الصورة' }) };
  if (imageBase64.length > 10_000_000) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'الصورة كبيرة جداً' }) };

  const styleKey = STYLE_PROMPTS[style] ? style : 'classic';
  const sp = STYLE_PROMPTS[styleKey];
  const greetStr = greeting ? 'Arabic greeting text: "' + greeting.slice(0, 200) + '"' : 'Eid Mubarak greeting';
  const nameStr = name ? ', dedicated to ' + name.slice(0, 50) : '';
  const fullPrompt = sp.prompt + ' Include ' + greetStr + nameStr + '. High-resolution, professional, beautiful.';

  let falRes;
  try {
    falRes = await fetch('https://fal.run/fal-ai/fast-sdxl/image-to-image', {
      method: 'POST',
      headers: { 'Authorization': 'Key ' + FAL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageBase64,
        prompt: fullPrompt,
        negative_prompt: sp.negative,
        strength: 0.65,
        num_inference_steps: 30,
        guidance_scale: 7.5,
        image_size: 'square_hd',
        seed: Math.floor(Math.random() * 9999999),
      }),
    });
  } catch (netErr) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'الخدمة غير متاحة حالياً.' }) };
  }

  if (!falRes.ok) {
    const errText = await falRes.text().catch(() => '');
    let userErr = 'حدث خطأ أثناء التوليد.';
    if (falRes.status === 402 || errText.includes('balance') || errText.includes('credit')) {
      userErr = 'الخدمة مؤقتاً غير متاحة. يرجى المحاولة لاحقاً.';
    } else if (falRes.status === 429) {
      userErr = 'الخادم مشغول. يرجى الانتظار دقيقة.';
    }
    return { statusCode: falRes.status, headers: CORS, body: JSON.stringify({ error: userErr }) };
  }

  let result;
  try { result = await falRes.json(); }
  catch { return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'استجابة غير متوقعة من الخادم' }) }; }

  const imageUrl = result?.images?.[0]?.url || result?.image?.url || result?.url;
  if (!imageUrl) return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'لم يُستلم رابط الصورة' }) };

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ imageUrl, style: styleKey }) };
};
