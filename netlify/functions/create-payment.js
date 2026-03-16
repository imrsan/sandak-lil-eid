'use strict';
const CORS={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};

exports.handler = async(event) => {
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers:CORS,body:''};
  if(event.httpMethod!=='POST') return {statusCode:405,headers:CORS,body:''};

  const MF_KEY = process.env.MF_API_KEY;
  if(!MF_KEY) return {statusCode:500,headers:CORS,body:JSON.stringify({error:'بوابة الدفع غير مهيأة'})};

  let body;
  try{body=JSON.parse(event.body||'{}');}catch{return {statusCode:400,headers:CORS,body:JSON.stringify({error:'طلب غير صالح'})};}

  const {redirectUrl} = body;
  const origin = redirectUrl || 'https://glittering-axolotl-47968b.netlify.app';

  try {
    // MyFatoorah - Initiate payment (v2 API)
    const mfRes = await fetch('https://api.myfatoorah.com/v2/InitiatePayment', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MF_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        InvoiceAmount: 2,
        CurrencyIso: 'KWD',
      }),
    });

    if(!mfRes.ok){
      const txt = await mfRes.text().catch(()=>'');
      return {statusCode:200,headers:CORS,body:JSON.stringify({error:'خطأ في بوابة الدفع: '+mfRes.status})};
    }

    const mfData = await mfRes.json();
    const paymentMethods = mfData?.Data?.PaymentMethods;
    if(!paymentMethods || paymentMethods.length===0){
      return {statusCode:200,headers:CORS,body:JSON.stringify({error:'لا توجد طرق دفع متاحة'})};
    }

    // Use first available payment method
    const methodId = paymentMethods[0].PaymentMethodId;

    // Execute payment
    const execRes = await fetch('https://api.myfatoorah.com/v2/ExecutePayment', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MF_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        PaymentMethodId: methodId,
        CustomerName: 'Sandak Eid User',
        DisplayCurrencyIso: 'KWD',
        MobileCountryCode: '+965',
        CustomerMobile: '00000000',
        CustomerEmail: 'user@sandak-eid.com',
        InvoiceValue: 2,
        CallBackUrl: origin + '/?payment=success',
        ErrorUrl: origin + '/?payment=error',
        Language: 'ar',
        CustomerReference: 'EID5-' + Date.now(),
        CustomerCivilId: '',
        UserDefinedField: 'sandak_5credits',
        ExpiryDate: '',
        InvoiceItems: [{
          ItemName: 'سندك للعيد — 5 تهنئات',
          Quantity: 1,
          UnitPrice: 2,
        }],
      }),
    });

    if(!execRes.ok){
      const txt = await execRes.text().catch(()=>'');
      return {statusCode:200,headers:CORS,body:JSON.stringify({error:'فشل إنشاء طلب الدفع'})};
    }

    const execData = await execRes.json();
    const paymentUrl = execData?.Data?.PaymentURL;
    const invoiceId = execData?.Data?.InvoiceId;

    if(!paymentUrl){
      return {statusCode:200,headers:CORS,body:JSON.stringify({error:'لم يُستلم رابط الدفع'})};
    }

    return {statusCode:200,headers:CORS,body:JSON.stringify({paymentUrl,invoiceId})};

  } catch(err) {
    return {statusCode:503,headers:CORS,body:JSON.stringify({error:'خطأ في الاتصال بـ MyFatoorah'})};
  }
};
