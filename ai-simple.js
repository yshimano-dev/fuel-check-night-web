(function(){
'use strict';
// Set this to the Cloudflare Worker URL only after cloud credentials,
// access controls and company authorization have been verified.
const endpoint=(window.FUEL_AI_ENDPOINT||'').replace(/\/$/,'');
const panel=document.getElementById('pairPanel');
if(!panel)return;
// Show a single main photo workflow; keep the expert OCR path collapsed.
const legacy=document.getElementById('photoSteps')?.closest('.panel');
if(legacy){
 const detail=document.createElement('details');detail.id='expertOcr';
 detail.innerHTML='<summary style="padding:10px;font-weight:700">追加の写真・詳細なOCR操作（必要な場合だけ）</summary>';
 legacy.parentNode.insertBefore(detail,legacy);detail.appendChild(legacy);
 const oldPanel=document.getElementById('ocrPanel');if(oldPanel)detail.appendChild(oldPanel);
}
const btn=document.getElementById('pairRun');
btn.textContent='写真2枚を読み取る（端末内OCR）';
const bNew=document.createElement('button');bNew.type='button';bNew.className='btn primary';bNew.textContent='AIで2枚を読み取る';
const newWrap=document.createElement('div');newWrap.className='buttons';
newWrap.style.marginTop='8px';newWrap.appendChild(bNew);
btn.closest('.buttons').before(newWrap);
const hint=document.createElement('p');hint.className='small';newWrap.after(hint);
if(!endpoint){bNew.hidden=true;hint.textContent='写真は端末内OCRで読み取れます。高精度AIは専用サーバー接続後に利用できます。';}
else{btn.classList.remove('primary');hint.textContent='AI読取を使うと写真2枚をGoogle Cloud Visionに一時送信します。勤務先の許可を得た帳票だけ利用してください。失敗時は端末内OCRを使えます。';}
const fresh=document.createElement('button');fresh.className='btn';fresh.type='button';fresh.textContent='新しい荷卸し（入力を消去）';fresh.onclick=()=>resetAll();panel.appendChild(fresh);
// Only accept candidates aligned with the report template. Ambiguous rows stay blank.
function draft(before,after){
 if(!window.FuelLayoutParser)throw Error('AIの帳票解析コードが読み込まれていません');
 return window.FuelLayoutParser.parse(before,after);
}
async function convertImage(file){
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error('画像を開けません'));i.src=url});
  const c=document.createElement('canvas'),s=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
  c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',.82).split(',')[1];
 }finally{URL.revokeObjectURL(url)}
}
bNew.onclick=async()=>{
 const before=document.getElementById('pairBefore')?.files?.[0],after=document.getElementById('pairAfter')?.files?.[0];
 if(!before||!after){alert('荷卸し前と後の写真2枚を選んでください');return}
 let code=sessionStorage.getItem('fuel_shift_code');
 if(!/^\d{6}$/.test(code||'')){
  code=prompt('夜勤グループの6桁コードを入力してください')||'';
  if(!/^\d{6}$/.test(code)){alert('6桁の数字を入力してください');return}
 }
 bNew.disabled=true;
 const status=document.getElementById('pairStatus');
 try{
  status.textContent='写真を圧縮してAIで文字認識中…';
  const images=await Promise.all([convertImage(before),convertImage(after)]);
  const res=await fetch(endpoint+'/ocr',{method:'POST',headers:{'Content-Type':'application/json','X-Shift-Code':code},body:JSON.stringify({images}),cache:'no-store'});
  const data=await res.json();
  if(!res.ok){
   if(res.status===401)sessionStorage.removeItem('fuel_shift_code');
   throw Error(({incorrect_code:'コードが違います',monthly_limit:'今月のAI利用上限に達しました',vision_unavailable:'AIサーバーを利用できません',not_configured:'管理者側のAI接続が未完了です',too_many_requests:'短時間に利用が集中しています'})[data.error]||'通信エラー '+res.status);
  }
  sessionStorage.setItem('fuel_shift_code',code);
  if(!Array.isArray(data.results)||data.results.length!==2)throw Error('画像の読み取り結果がありません');
  const parsed=draft(data.results[0],data.results[1]);
  window.eneosPairTest.loadAiResults(parsed.drafts);
  status.textContent='AI候補：5つの項目中'+parsed.completeColumns+'項目を抽出。'+parsed.warnings.join(' ')+' すべての数字を印刷物と照合してください。';
  if(parsed.warnings.length)document.getElementById('pairCropDetail').open=true;
 }catch(e){
  status.textContent='AIを使用できません：'+e.message+'。端末内OCRか手入力をご利用ください。';
 }finally{bNew.disabled=false}
};
window.fuelVisionParserForTests={draft};
})();