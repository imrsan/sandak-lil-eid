// netlify/functions/generate.js — FIXED v2
// الإصلاح الرئيسي: رفع الصورة إلى fal storage أولاً ثم استخدام الـ URL

const EID_SCENES = {
  mosque: {
    name: 'أمام المسجد',
    prompt: 'A stunning photorealistic Eid al-Fitr greeting card scene. Grand illuminated mosque at night with golden glowing minarets, crescent moon and stars in deep blue sky, traditional Islamic lanterns hanging between minarets, warm golden atmospheric lighting. Celebratory Eid atmosphere, cinematic composition, 8K ultra-detailed.',
    negative: 'ugly, blurry, low quality, cartoon, text, watermark, people, faces, deformed',
  },
  lanterns: {
    name: 'فوانيس رمضان',
    prompt: 'Magical Ramadan and Eid greeting scene. Hundreds of glowing golden and copper Arabic fanoos lanterns floating in a beautiful dark atmospheric alley, warm amber bokeh light, traditional architecture with ornate wooden mashrabiya windows, rose petals floating, cinematic warm glow, 8K photorealistic.',
    negative: 'ugly, blurry, low quality, cartoon, people, faces, watermark, modern elements',
  },
  iftar: {
    name: 'مائدة الإفطار',
    prompt: 'Lavish Ramadan iftar table greeting card, beautifully styled overhead view or elegant angle. Traditional Arabic dishes, golden dates on silver tray, Arabic coffee dallah, fresh juices, decorative flowers, ornate golden tableware, warm sunset light through ornate windows, lush fabrics, 8K cinematic.',
    negative: 'ugly, blurry, people, faces, modern fast food, low quality, plastic',
  },
  crescent: {
    name: 'هلال العيد',
    prompt: 'Majestic Eid greeting illustration. Giant glowing golden crescent moon over a silhouetted Arabian cityscape with minarets, thousands of twinkling stars, colorful Eid balloons and fireworks in background, golden sparkles raining down, deep indigo and gold sky gradient, cinematic dramatic composition, 8K.',
    negative: 'ugly, blurry, low quality, cartoon, realistic people, watermark',
  },
  heritage: {
    name: 'الحارة التراثية',
    prompt: 'Beautiful traditional Arabian heritage old quarter during Eid celebration. Ancient stone architecture, wooden mashrabiya windows with hanging Eid lights and golden lanterns, children silhouettes playing, flags and banners, cobblestone streets, warm evening golden magic hour light, cinematic depth, 8K photorealistic.',
    negative: 'ugly, modern architecture, blurry, low quality, people faces clearly visible',
  },
  garden: {
    name: 'حديقة العيد',
    prompt: 'Stunning Eid celebration garden paradise. Lush Arabian garden with blooming white jasmine, roses and palm trees, strings of warm golden fairy lights between trees, ornate marble fountain, butterfly and flower petals floating in air, soft dreamy bokeh, magic golden hour, 8K photorealistic luxurious.',
    negative: 'ugly, blurry, low quality, people, faces, plastic flowers, artificial',
  },
  fireworks: {
    name: 'احتفال الألعاب',
    prompt: 'Spectacular Eid celebration fireworks night scene. Magnificent golden, green and white fireworks exploding over an Arabian city skyline with illuminated minarets reflected in water, crowd silhouettes celebrating below, smoke wisps, city lights bokeh, 8K cinematic dramatic wide shot.',
    negative: 'ugly, blurry, faces clearly visible, low quality, daytime',
  },
  makkah: {
    name: 'فجر العيد',
    prompt: 'Serene Eid dawn greeting scene. Breathtaking sunrise painting the sky in pink, gold and orange hues over a silhouetted Arabian landscape with minarets, dew-covered flowers in foreground, birds flying, rays of light breaking through clouds, peaceful spiritual atmosphere, 8K golden hour photorealistic.',
    negative: 'ugly, blurry, people, faces, low quality, dark, night',
  },
  golden: {
    name: 'تهنئة ذهبية',
    prompt: 'Opulent luxury gold Eid greeting card design. Rich golden Arabic geometric patterns and intricate Islamic arabesque, gold coins and ornaments, pearl strings, red and white roses on black velvet background, golden light rays, premium texture, glamorous and regal, 8K ultra-detailed studio photography.',
    negative: 'ugly, blurry, low quality, cheap, people, faces, modern',
  },
  family: {
    name: 'بيت العيد',
    prompt: 'Warm inviting Eid family home interior setting. Beautifully decorated Arabian living majlis with Eid ornaments, colorful lights, date palm decorations, traditional Eid sweets and kahwa spread on ornate tray, cushions with golden embroidery, warm soft indoor lighting, cozy festive atmosphere, 8K photorealistic.',
    negative: 'ugly, blurry, people, faces, low quality, cold lighting, modern minimalist',
  },
};

const rateLimitMap = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_IP || '8');
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

// رفع الصورة إلى fal storage وإرجاع public URL
async function uploadImageToFal(base64Data, mimeType, falKey) {
  // إزالة data URL prefix إذا وجد
  const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
  const binaryStr = atob(base64Clean);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const filename = 'eid-photo-' + Date.now() + '.' + ext;

  // رفع إلى fal storage
  const uploadRes = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
    method: 'POST',
    headers: {
      'Authorization': 'Key ' + falKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_name: filename, content_type: mimeType }),
  });

  if (!uploadRes.ok) {
    // fallback: try direct upload
    const directRes = await fetch('https://fal.run/storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Key ' + falKey,
        'Content-Type': mimeType,
        'X-Filename': filename,
      },
      body: bytes.buffer,
    });
    if (!directRes.ok) {
      const errT = await directRes.text();
      throw new Error('Upload failed: ' + directRes.status + ' ' + errT.slice(0,200));
    }
    const directData = await directRes.json();
    return directData.url || directData.file_url;
  }

  const initData = await uploadRes.json();
  
  // رفع الملف إلى الـ presigned URL
  const putRes = await fetch(initData.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: bytes.buffer,
  });
  if (!putRes.ok) throw new Error('PUT upload failed: ' + putRes.status);

  return initData.file_url;
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

  const { imageBase64, imageType = 'image/jpeg', style, greeting = '', name = '' } = body;
  if (!imageBase64) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'لم يتم إرسال الصورة' }) };

  const sceneKey = EID_SCENES[style] ? style : 'lanterns';
  const scene = EID_SCENES[sceneKey];

  // 1. رفع الصورة إلى fal storage
  let imageUrl;
  try {
    imageUrl = await uploadImageToFal(imageBase64, imageType, FAL_KEY);
  } catch (upErr) {
    console.error('Upload error:', upErr.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.' }) };
  }

  // 2. توليد الصورة باستخدام الـ URL
  const greetingLine = greeting ? ' Text overlay to composite separately: "' + greeting.slice(0, 120) + '".' : '';
  const nameLine = name ? ' Personalized for: ' + name.slice(0, 40) + '.' : '';
  const fullPrompt = scene.prompt + greetingLine + nameLine;

  let falRes;
  try {
    falRes = await fetch('https://fal.run/fal-ai/fast-sdxl/image-to-image', {
      method: 'POST',
      headers: {
        'Authorization': 'Key ' + FAL_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: fullPrompt,
        negative_prompt: scene.negative + ', text errors, watermark, ugly, deformed, wrong anatomy',
        strength: 0.75,
        num_inference_steps: 30,
        guidance_scale: 8.0,
        image_size: 'square_hd',
        seed: Math.floor(Math.random() * 9999999),
      }),
    });
  } catch (netErr) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'الخدمة غير متاحة حالياً. يرجى المحاولة لاحقاً.' }) };
  }

  if (!falRes.ok) {
    const errText = await falRes.text().catch(() => '');
    console.error('fal.ai error:', falRes.status, errText.slice(0, 300));
    let userErr = 'حدث خطأ أثناء التوليد. يرجى المحاولة مرة أخرى. (كود: ' + falRes.status + ')';
    if (falRes.status === 402 || errText.includes('balance') || errText.includes('credit') || errText.includes('payment')) {
      userErr = 'رصيد الخدمة نفد. يرجى التواصل مع المسؤول.';
    } else if (falRes.status === 401 || falRes.status === 403) {
      userErr = 'خطأ في مفتاح الخدمة. يرجى التواصل مع المسؤول.';
    } else if (falRes.status === 429) {
      userErr = 'الخادم مشغول. يرجى الانتظار دقيقة ثم المحاولة.';
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: userErr }) };
  }

  let result;
  try { result = await falRes.json(); }
  catch { return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'استجابة غير متوقعة من الخادم' }) }; }

  const outUrl = result?.images?.[0]?.url || result?.image?.url || result?.url;
  if (!outUrl) return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'لم يُستلم رابط الصورة' }) };

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ imageUrl: outUrl, style: sceneKey, sceneName: scene.name }),
  };
};
