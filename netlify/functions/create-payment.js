'use strict';
const CORS={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};

// MyFatoorah Jordan
const MF_BASE='https://jordan.myfatoorah.com';

exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:200,headers:CORS,body:''};
  if(event.httpMethod!=='POST')return{statusCode:405,headers:CORS,body:''};

  const MF_KEY=process.env.MF_API_KEY;
  if(!MF_KEY){
    console.error('MF_API_KEY not set');
    return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر فتح بوابة الدفع. يرجى المحاولة لاحقاً.'})};
  }

  let body;
  try{body=JSON.parse(event.body||'{}');}
  catch{return{statusCode:400,headers:CORS,body:JSON.stringify({error:'طلب غير صالح'})};}

  const redirectUrl=body.redirectUrl||'https://glittering-axolotl-47968b.netlify.app/?payment=success';
  const errorUrl=body.redirectUrl
    ?body.redirectUrl.replace('success','error')
    :'https://glittering-axolotl-47968b.netlify.app/?payment=error';

  // السعر 15 ريال سعودي = ~2 دينار أردني تقريباً
  const AMOUNT=15;
  const CURRENCY='SAR';

  try{
    // الخطوة 1: الحصول على طرق الدفع
    const initRes=await fetch(MF_BASE+'/v2/InitiatePayment',{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+MF_KEY,
        'Content-Type':'application/json',
        'Accept':'application/json'
      },
      body:JSON.stringify({InvoiceAmount:AMOUNT,CurrencyIso:CURRENCY})
    });

    const initData=await initRes.json().catch(()=>({}));
    console.log('MF InitiatePayment status:',initRes.status,'IsSuccess:',initData.IsSuccess);

    if(!initData.IsSuccess){
      console.error('MF InitiatePayment failed:',JSON.stringify(initData).slice(0,400));
      return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر فتح بوابة الدفع. يرجى المحاولة لاحقاً.'})};
    }

    const methods=initData.Data?.PaymentMethods||[];
    if(!methods.length){
      console.error('No payment methods returned');
      return{statusCode:200,headers:CORS,body:JSON.stringify({error:'لا توجد طرق دفع متاحة. تواصل مع الدعم.'})};
    }

    // اختيار أفضل طريقة دفع
    const method=
      methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('visa'))||
      methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('master'))||
      methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('card'))||
      methods[0];

    console.log('Selected payment method:',method.PaymentMethodEn,'ID:',method.PaymentMethodId);

    // الخطوة 2: تنفيذ الدفع
    const execRes=await fetch(MF_BASE+'/v2/ExecutePayment',{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+MF_KEY,
        'Content-Type':'application/json',
        'Accept':'application/json'
      },
      body:JSON.stringify({
        PaymentMethodId:method.PaymentMethodId,
        CustomerName:'Sandak Eid Customer',
        DisplayCurrencyIso:CURRENCY,
        MobileCountryCode:'+966',
        CustomerMobile:'0500000000',
        CustomerEmail:'customer@sandakeid.com',
        InvoiceValue:AMOUNT,
        CallBackUrl:redirectUrl,
        ErrorUrl:errorUrl,
        Language:'ar',
        CustomerReference:'sandak_'+Date.now(),
        UserDefinedField:'5credits',
        InvoiceItems:[{ItemName:'سندك للعيد — 5 تهنئات',Quantity:1,UnitPrice:AMOUNT}]
      })
    });

    const execData=await execRes.json().catch(()=>({}));
    console.log('MF ExecutePayment status:',execRes.status,'IsSuccess:',execData.IsSuccess);

    if(!execData.IsSuccess||!execData.Data?.PaymentURL){
      console.error('MF ExecutePayment failed:',JSON.stringify(execData).slice(0,400));
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
    console.error('Payment error:',err.message);
    return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر الاتصال ببوابة الدفع. يرجى المحاولة لاحقاً.'})};
  }
};
