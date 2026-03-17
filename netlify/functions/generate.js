'use strict';
// generate.js — FAL.ai flux/schnell
const CORS={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const SIZES={sq:'square_hd',st:'portrait_16_9',cd:'landscape_4_3'};

exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:200,headers:CORS,body:''};
  if(event.httpMethod!=='POST')return{statusCode:405,headers:CORS,body:''};
  const FAL_KEY=process.env.FAL_KEY;
  if(!FAL_KEY)return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر الإنشاء حالياً.'})};
  let body;
  try{body=JSON.parse(event.body||'{}');}
  catch{return{statusCode:400,headers:CORS,body:JSON.stringify({error:'طلب غير صالح'})};}
  const{prompt,size='sq',seed}=body;
  if(!prompt)return{statusCode:400,headers:CORS,body:JSON.stringify({error:'تعذّر الإنشاء.'})};
  try{
    const res=await fetch('https://fal.run/fal-ai/flux/schnell',{
      method:'POST',
      headers:{'Authorization':'Key '+FAL_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({
        prompt:prompt,
        image_size:SIZES[size]||'square_hd',
        num_inference_steps:4,
        num_images:1,
        enable_safety_checker:false,
        sync_mode:true,
        seed:seed||Math.floor(Math.random()*9999999)
      })
    });
    if(!res.ok){
      const t=await res.text().catch(()=>'');
      console.error('FAL error:',res.status,t.slice(0,200));
      if(res.status===402)return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر الإنشاء. يرجى المحاولة لاحقاً.'})};
      if(res.status===429)return{statusCode:200,headers:CORS,body:JSON.stringify({error:'الخدمة مشغولة. أعد المحاولة بعد لحظة.'})};
      return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر إنشاء الصورة. يرجى المحاولة مجدداً.'})};
    }
    const result=await res.json();
    const imageUrl=result?.images?.[0]?.url;
    if(!imageUrl){
      console.error('No image URL in FAL response:',JSON.stringify(result).slice(0,200));
      return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر استلام الصورة. يرجى المحاولة مجدداً.'})};
    }
    return{statusCode:200,headers:CORS,body:JSON.stringify({imageUrl})};
  }catch(err){
    console.error('FAL network error:',err.message);
    return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر الاتصال. تحقق من الإنترنت وأعد المحاولة.'})};
  }
};
