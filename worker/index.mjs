// Fuel-check OCR proxy. Do not put Google Cloud API keys in the browser.
const ALLOW_ORIGIN = 'https://yshimano-dev.github.io';
function response(body,status=200,origin=ALLOW_ORIGIN){
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin','X-Content-Type-Options':'nosniff'}});
}
function equal(a,b){
  if(typeof a!=='string'||typeof b!=='string')return false;
  const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
  let diff=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i%x.length]||0)^(y[i%y.length]||0);
  return diff===0;
}
function imageString(raw) {
  if(typeof raw!=='string' || raw.length>7_000_000 || raw.length<2000)return null;
  const s=raw.replace(/^data:image\/(jpeg|png|webp);base64,/, '');
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s)&&s.length>1000?s:null;
}
export class MonthlyQuota {
  constructor(ctx){this.ctx=ctx;this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS usage(month TEXT PRIMARY KEY, count INTEGER NOT NULL)');}
  async fetch(req){
    const {amount=2}=await req.json();
    const month=new Date().toISOString().slice(0,7);
    this.sql.exec('INSERT OR IGNORE INTO usage(month,count) VALUES (?,0)',month);
    const max=100; // HARD monthly image-unit limit, adjustable only by owner.
    const ret=this.sql.exec('UPDATE usage SET count=count+? WHERE month=? AND count+?<=? RETURNING count',amount,month,amount,max);
    const count=[...ret][0]?.count;
    return response(count===undefined?{ok:false,reason:'monthly_limit'}:{ok:true,count},count===undefined?429:200);
  }
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  const path=new URL(request.url).pathname;
  if(origin!==ALLOW_ORIGIN)return response({error:'origin_not_allowed'},403);
  if(request.method==='OPTIONS'&&path==='/ocr')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':ALLOW_ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Shift-Code','Access-Control-Max-Age':'300','Vary':'Origin'}});
  if(path==='/health'&&request.method==='GET')return response({ready:!!env.GOOGLE_VISION_API_KEY&&!!env.SHIFT_SHARED_CODE});
  if(path!=='/ocr'||request.method!=='POST')return response({error:'not_found'},404);
  if(!env.SHIFT_SHARED_CODE||!env.GOOGLE_VISION_API_KEY||!env.MONTHLY)return response({error:'not_configured'},503);
  // Limit attempted passwords too, not just successful OCR requests.
  if(env.RATE_LIMITER){
   const key=request.headers.get('CF-Connecting-IP')||'unknown';
   const {success}=await env.RATE_LIMITER.limit({key:'ocr-ip:'+key});
   if(!success)return response({error:'too_many_requests'},429);
  }
  const code=request.headers.get('X-Shift-Code')||'';
  if(!/^\d{6}$/.test(code)||!equal(code,env.SHIFT_SHARED_CODE))return response({error:'incorrect_code'},401);
  const len=Number(request.headers.get('content-length')||0);
  if(len>14_000_000)return response({error:'image_too_large'},413);
  let obj;
  try{obj=await request.json()}catch{return response({error:'invalid_json'},400)}
  if(!Array.isArray(obj?.images)||obj.images.length!==2)return response({error:'two_images_required'},400);
  const images=obj.images.map(imageString);
  if(images.some(x=>!x))return response({error:'invalid_images'},400);
  // Single Durable Object serializes usage checks globally.
  const stub=env.MONTHLY.get(env.MONTHLY.idFromName('fuel-check-global'));
  const check=await stub.fetch('https://internal/check',{method:'POST',body:JSON.stringify({amount:2})});
  if(!check.ok)return response({error:'monthly_limit'},429);
  const requestBody={requests:images.map(image=>({image:{content:image},features:[{type:'DOCUMENT_TEXT_DETECTION'}]}))};
  let upstream;
  try{
   upstream=await fetch('https://vision.googleapis.com/v1/images:annotate?key='+encodeURIComponent(env.GOOGLE_VISION_API_KEY),{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(requestBody),signal:AbortSignal.timeout(22000)
   });
  }catch{return response({error:'vision_network_error'},502)}
  if(!upstream.ok)return response({error:'vision_unavailable',status:upstream.status},502);
  const data=await upstream.json();
  const results=(data.responses||[]).map(p=>{
   const f=p.fullTextAnnotation;
   const words=[];
   for(const pg of f?.pages||[])for(const block of pg.blocks||[])for(const para of block.paragraphs||[])for(const w of para.words||[]){
    const text=w.symbols?.map(s=>s.text).join('')||'';
    const vs=w.boundingBox?.vertices||[];
    if(!text||vs.length<4)continue;
    words.push({text,x:Math.min(...vs.map(v=>v.x||0)),y:Math.min(...vs.map(v=>v.y||0)),
      width:Math.max(...vs.map(v=>v.x||0))-Math.min(...vs.map(v=>v.x||0)),
      height:Math.max(...vs.map(v=>v.y||0))-Math.min(...vs.map(v=>v.y||0))});
   }
   return {text:(f?.text||p.textAnnotations?.[0]?.description||'').slice(0,12000),words,pageWidth:f?.pages?.[0]?.width||0,pageHeight:f?.pages?.[0]?.height||0,error:p.error?.message||null};
  });
  return response({results});
 }
};
