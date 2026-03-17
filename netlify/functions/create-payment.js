'use strict';
const CORS={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const MF_BASE='https://api.myfatoorah.com';
// باقتان: 1 دينار = 5 دعوات | 2 دينار = 10 دعوات
const PLANS={
  '1':{amount:1,currency:'JOD',credits:5,label:'5 دعوات'},
  '2':{amount:2,currency:'JOD',credits:10,label:'10 دعوات'}
};
exports.handler=async(event)=>{
  if(event.httpMethod==='OPTIONS')return{statusCode:200,headers:CORS,body:''};
  if(event.httpMethod!=='POST')return{statusCode:405,headers:CORS,body:''};
  const MF_KEY=process.env.MF_API_KEY;
  if(!MF_KEY){console.error('MF_API_KEY not set');return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر فتح بوابة الدفع.'})};}
  let body;
  try{body=JSON.parse(event.body||'{}');}catch{return{statusCode:400,headers:CORS,body:JSON.stringify({error:'طلب غير صالح'})};}
  const plan=PLANS[body.plan]||PLANS['1'];
  const redirectUrl=body.redirectUrl||'https://glittering-axolotl-47968b.netlify.app/?payment=success';
  const errorUrl=redirectUrl.replace('success','error');
  try{
    const initRes=await fetch(MF_BASE+'/v2/InitiatePayment',{
      method:'POST',
      headers:{'Authorization':'Bearer '+MF_KEY,'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({InvoiceAmount:plan.amount,CurrencyIso:plan.currency})
    });
    const initText=await initRes.text();
    let initData;try{initData=JSON.parse(initText);}catch{initData={};}
    console.log('InitiatePayment',initRes.status,initData.IsSuccess,'plan:',plan.amount,plan.currency);
    if(!initData.IsSuccess){
      console.error('InitiatePayment fail:',initText.slice(0,500));
      return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر تهيئة الدفع. يرجى التحقق من إعدادات الحساب.'})};
    }
    const methods=initData.Data?.PaymentMethods||[];
    if(!methods.length)return{statusCode:200,headers:CORS,body:JSON.stringify({error:'لا توجد طرق دفع متاحة.'})};
    const method=methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('knet'))||methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('visa'))||methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('master'))||methods.find(m=>m.PaymentMethodEn?.toLowerCase().includes('card'))||methods[0];
    console.log('Method:',method.PaymentMethodEn,'ID:',method.PaymentMethodId);
    const execRes=await fetch(MF_BASE+'/v2/ExecutePayment',{
      method:'POST',
      headers:{'Authorization':'Bearer '+MF_KEY,'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({
        PaymentMethodId:method.PaymentMethodId,
        CustomerName:'Sandak Eid',
        DisplayCurrencyIso:plan.currency,
        MobileCountryCode:'+962',
        CustomerMobile:'0790000000',
        CustomerEmail:'customer@sandakeid.com',
        InvoiceValue:plan.amount,
        CallBackUrl:redirectUrl+'&plan='+body.plan+'&credits='+plan.credits,
        ErrorUrl:errorUrl,
        Language:'ar',
        CustomerReference:'sandak_'+Date.now(),
        UserDefinedField:plan.credits+'credits',
        InvoiceItems:[{ItemName:'\u0633\u0646\u062f\u0643 \u0644\u0644\u0639\u064a\u062f \u2014 '+plan.label,Quantity:1,UnitPrice:plan.amount}]
      })
    });
    const execText=await execRes.text();
    let execData;try{execData=JSON.parse(execText);}catch{execData={};}
    console.log('ExecutePayment',execRes.status,execData.IsSuccess);
    if(!execData.IsSuccess||!execData.Data?.PaymentURL){
      console.error('ExecutePayment fail:',execText.slice(0,500));
      return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر إنشاء رابط الدفع.'})};
    }
    return{statusCode:200,headers:CORS,body:JSON.stringify({paymentUrl:execData.Data.PaymentURL,invoiceId:execData.Data.InvoiceId,credits:plan.credits})};
  }catch(err){
    console.error('Error:',err.message);
    return{statusCode:200,headers:CORS,body:JSON.stringify({error:'تعذّر الاتصال. يرجى المحاولة مجدداً.'})};
  }
};
