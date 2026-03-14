// netlify/functions/generate.js
// سندك للعيد — 10 مشاهد احتفالية لتهنئة العيد والرمضان

const EID_SCENES = {

  // 1 - مسجد ليلي
  mosque: {
    name: 'أمام المسجد',
    prompt: `Seamlessly composite the person from the uploaded photo standing in front of a grand illuminated mosque at night. The mosque glows with warm golden light, crescent moon and stars fill the deep blue sky, lanterns hang between minarets. The person stands naturally at the mosque entrance as if greeting Eid worshippers. Maintain the person's face, clothing and likeness exactly. Photorealistic, cinematic lighting, 8K quality. Eid al-Fitr celebration atmosphere.`,
    negative: 'distorted face, wrong person, different outfit, blurry, low quality, cartoon',
  },

  // 2 - فوانيس رمضان
  lanterns: {
    name: 'فوانيس رمضان',
    prompt: `Composite the person from the uploaded photo into a magical Ramadan lantern scene. Hundreds of glowing golden and copper fanoos lanterns float around them in a dark atmospheric alley. Warm amber light dances on their face. The person appears joyful, surrounded by this traditional Ramadan ambiance. Keep the person's exact appearance. Photorealistic, warm cinematic lighting.`,
    negative: 'distorted face, blurry person, wrong appearance, low quality',
  },

  // 3 - مائدة إفطار
  iftar: {
    name: 'مائدة الإفطار',
    prompt: `Place the person from the uploaded photo at the head of a lavish Ramadan iftar table. The long table is beautifully spread with traditional Arabic dishes, dates, juices, and decorative flowers. Warm sunset light streams through ornate windows. The person sits graciously at the table, welcoming guests. Preserve their exact face and appearance. Photorealistic, warm golden hour lighting.`,
    negative: 'distorted face, wrong person, blurry, low quality, modern fast food',
  },

  // 4 - هلال العيد
  crescent: {
    name: 'هلال العيد',
    prompt: `Create a majestic Eid greeting card compositing the person from the uploaded photo. They stand on a hilltop beneath a giant glowing crescent moon surrounded by thousands of stars. Traditional Arabic patterns frame the scene. The person wears traditional Gulf thobe or abaya (matching their original clothing style). Golden sparkles and light rays emanate around them. Cinematic, dramatic, beautiful. Keep exact face likeness.`,
    negative: 'distorted features, wrong face, blurry, low quality',
  },

  // 5 - قصبة تراثية
  heritage: {
    name: 'الحارة التراثية',
    prompt: `Composite the person from the uploaded photo into a beautiful traditional Arabian heritage quarter during Eid. Ancient stone architecture with wooden mashrabiya windows, decorated with colorful Eid lights and flags. Children play in the background, families celebrate. The person walks through the festive old town street. Warm evening golden light. Preserve their exact appearance and face.`,
    negative: 'modern architecture, wrong person, distorted, blurry, low quality',
  },

  // 6 - حديقة الورود
  garden: {
    name: 'حديقة العيد',
    prompt: `Place the person from the uploaded photo in a stunning Eid celebration garden. Lush Arabian garden with blooming jasmine, roses and palm trees. Colorful lights hang between the trees, ornate fountain in background. Soft evening light, butterflies and flower petals float in the air. The person stands elegantly surrounded by this paradise garden. Maintain their exact face and likeness. Dreamy, photorealistic.`,
    negative: 'distorted face, wrong person, blurry, artificial looking, low quality',
  },

  // 7 - احتفال الألعاب النارية
  fireworks: {
    name: 'احتفال الألعاب النارية',
    prompt: `Composite the person from the uploaded photo into a spectacular Eid fireworks celebration scene. They stand on a rooftop or waterfront promenade as magnificent fireworks explode in the night sky above — gold, green, white bursts over a city skyline with minarets. The person celebrates joyfully, arms raised. Their face is clearly visible and unchanged. Dramatic cinematic shot, 8K quality.`,
    negative: 'distorted face, wrong appearance, blurry, low quality, daytime',
  },

  // 8 - كعبة وحجاج
  makkah: {
    name: 'فجر العيد',
    prompt: `Create an Eid Mubarak greeting compositing the person from the uploaded photo at Eid dawn. They stand in a beautiful location as the sun rises, painting the sky in shades of pink, gold and orange. A distant minaret silhouette is visible. Dew-covered flowers in the foreground. The person looks serene and blessed, dressed in traditional Eid attire matching their original clothing style. Keep their exact face. Photorealistic, spiritual atmosphere.`,
    negative: 'distorted features, wrong person, low quality, dark, night',
  },

  // 9 - تهنئة ذهبية فاخرة
  golden: {
    name: 'تهنئة ذهبية',
    prompt: `Create a luxury gold Eid greeting card featuring the person from the uploaded photo as the central figure. Opulent golden Arabic calligraphy "عيد مبارك" arches above them. They are surrounded by floating gold coins, pearl strings, roses, and geometric Islamic patterns all in gold and deep burgundy. The person appears regal and celebratory. Studio-quality portrait with rich textures. Maintain their exact face and likeness.`,
    negative: 'distorted face, wrong person, blurry, low quality, cheap looking',
  },

  // 10 - أسرة وعائلة
  family: {
    name: 'بيت العيد',
    prompt: `Composite the person from the uploaded photo into a warm Eid family home setting. A beautifully decorated Arabian living room with Eid ornaments, date palms in pots, colorful lights. Traditional Eid sweets and kahwa on the table. The person sits comfortably as if welcoming Eid guests, warm smile. Soft indoor warm lighting, festive atmosphere. Keep their exact appearance and face clearly visible. Photorealistic.`,
    negative: 'distorted face, wrong person, blurry, low quality, wrong facial features',
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

  const sceneKey = EID_SCENES[style] ? style : 'lanterns';
  const scene = EID_SCENES[sceneKey];

  // Build final prompt with greeting and name
  const greetingLine = greeting ? ' Arabic text overlay: "' + greeting.slice(0, 150) + '".' : '';
  const nameLine = name ? ' Dedicated to: ' + name.slice(0, 40) + '.' : '';
  const fullPrompt = scene.prompt + greetingLine + nameLine + ' Ultra high quality, photorealistic compositing, 8K resolution.';

  let falRes;
  try {
    falRes = await fetch('https://fal.run/fal-ai/fast-sdxl/image-to-image', {
      method: 'POST',
      headers: { 'Authorization': 'Key ' + FAL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageBase64,
        prompt: fullPrompt,
        negative_prompt: scene.negative + ', text errors, watermark, ugly, deformed',
        strength: 0.72,
        num_inference_steps: 35,
        guidance_scale: 8.5,
        image_size: 'square_hd',
        seed: Math.floor(Math.random() * 9999999),
      }),
    });
  } catch (netErr) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'الخدمة غير متاحة حالياً. يرجى المحاولة لاحقاً.' }) };
  }

  if (!falRes.ok) {
    const errText = await falRes.text().catch(() => '');
    let userErr = 'حدث خطأ أثناء التوليد. يرجى المحاولة مرة أخرى.';
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

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ imageUrl, style: sceneKey, sceneName: scene.name }),
  };
};
