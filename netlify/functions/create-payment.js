'use strict';
// create-payment.js — MyFatoorah FIXED
// endpoint صحيح: api.myfatoorah.com
// عملة الحساب الأردني: JOD

const CORS={
  'Content-Type':'application/json',
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type'
};

// الـ endpoint الرسمي الموحّد لـ MyFatoorah لجميع الدول
const MF_BASE='https://api.myfatoorah.com';
const AMOUNT=2;      // 2 دينار أردني
const CURRENCY='JOD';

exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:200,headers:CORS,body:''};
  if(event.httpMethod!=='POST')return{statusCode:405,headers:CORS,body:''};

  const MF_KEY=process.env.MF_API_KEY;
  if(!MF_KEY){
    console.error('MF_API_KEY not set in env vars');
    return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر فتح بوابة الدفع.'})};
  }

  let body;
  try{body=JSON.parse(event.body||'{}');}
  catch{return{statusCode:400,headers:CORS,body:JSON.stringify({error:'طلب غير صالح'})};}

  const redirectUrl=body.redirectUrl||'https://glittering-axolotl-47968b.netlify.app/?payment=success';
  const errorUrl=redirectUrl.replace('success','error');

  try{
    // الخطوة 1 — الحصول على طرق الدفع المتاحة
    const initRes=await fetch(MF_BASE+'/v2/InitiatePayment',{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+MF_KEY,
        'Content-Type':'application/json',
        'Accept':'application/json'
      },
      body:JSON.stringify({InvoiceAmount:AMOUNT,CurrencyIso:CURRENCY})
    });

    const initText=await initRes.text();
    let initData;
    try{initData=JSON.parse(initText);}catch{initData={};}

    console.log('InitiatePayment status:',initRes.status,'IsSuccess:',initData.IsSuccess);

    if(!initData.IsSuccess){
      console.error('InitiatePayment failed:',initText.slice(0,500));
      return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر تهيئة الدفع. يرجى المحاولة لاحقاً.'})};
    }

    const methods=initData.Data?.PaymentMethods||[];
    if(!methods.length){
      console.error('No payment methods returned');
      return{statusCode:200,headers:CORS,body:JSON.stringify({error:'لا توجد طرق دفع متاحة.'})};
    }

    // اختيار أفضل طريقة
    const method=
      methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('knet'))||
      methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('visa'))||
      methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('master'))||
      methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('card'))||
      methods[0];

    console.log('Method:',method.PaymentMethodEn,'ID:',method.PaymentMethodId);

    // الخطوة 2 — تنفيذ الدفع
    const execRes=await fetch(MF_BASE+'/v2/ExecutePayment',{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+MF_KEY,
        'Content-Type':'application/json',
        'Accept':'application/json'
      },
      body:JSON.stringify({
        PaymentMethodId:method.PaymentMethodId,
        CustomerName:'Sandak Eid',
        DisplayCurrencyIso:CURRENCY,
        MobileCountryCode:'+962',
        CustomerMobile:'0790000000',
        CustomerEmail:'customer@sandakeid.com',
        InvoiceValue:AMOUNT,
        CallBackUrl:redirectUrl,
        ErrorUrl:errorUrl,
        Language:'ar',
        CustomerReference:'sandak_'+Date.now(),
        UserDefinedField:'5credits',
        InvoiceItems:[{ItemName:'\u0633\u0646\u062f\u0643 \u0644\u0644\u0639\u064a\u062f \u2014 5 \u062a\u0647\u0646\u0626\u0627\u062a',Quantity:1,UnitPrice:AMOUNT}]
      })
    });

    const execText=await execRes.text();
    let execData;
    try{execData=JSON.parse(execText);}catch{execData={};}

    console.log('ExecutePayment status:',execRes.status,'IsSuccess:',execData.IsSuccess);

    if(!execData.IsSuccess||!execData.Data?.PaymentURL){
      console.error('ExecutePayment failed:',execText.slice(0,500));
      return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر إنشاء رابط الدفع. يرجى المحاولة لاحقاً.'})};
    }

    return{
      statusCode:200,
      headers:CORS,
      body:JSON.stringify({
        paymentUrl:execData.Data.PaymentURL,
        invoiceId:execData.Data.InvoiceId
      })
    };

  }catch(err){
    console.error('Network/parse error:',err.message,err.stack?.slice(0,300));
    return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر الاتصال. يرجى المحاولة مجدداً.'})};
  }
};
