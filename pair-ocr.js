(function(){
'use strict';
const order=[['H',0,'14KL'],['R',1,'48KL'],['D',2,'14KL'],['K',9,'20KL']];
const fields=['A','B','C','D','Q'];
const configs=[
 {id:'beforePhysical',name:'前：下段の物理タンク実在庫量',side:'before',field:'A',rect:[35,51,17,17]},
 {id:'beforeReceipt',name:'前：右下の在庫レシート',side:'before',field:'B',rect:[76,63,19,26]},
 {id:'afterPhysical',name:'後：下段の物理タンク実在庫量',side:'after',field:'C',rect:[35,51,17,17]},
 {id:'afterReceipt',name:'後：右下の在庫レシート',side:'after',field:'D',rect:[76,63,19,26]},
 {id:'afterQ',name:'後：上段の当日入荷数量',side:'after',field:'Q',rect:[29,12,13,11]}
];
let fileMap={before:null,after:null},photoCanvases={},drafts={},states={},worker=null,running=false;
for(const [oil] of order)drafts[oil]={A:'',B:'',C:'',D:'',Q:''};
const st=document.createElement('style');
st.textContent=`#pairPanel{border:2px solid #75a8c5}.pair-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pair-grid>div{border:1px solid #d5e3ed;padding:10px;border-radius:9px;background:#f5faff}.pair-grid input{max-width:100%;font-size:13px}.pair-config{padding:12px 0;border-top:1px solid #d9e4eb}.pair-config .mini-controls{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pair-config input[type=range]{width:100%}.pair-crop{display:block;max-width:100%;width:auto;max-height:135px;border:1px solid #adbfcb;margin:8px 0;border-radius:5px}.pair-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.pair-table{min-width:630px;width:100%;border-collapse:collapse}.pair-table th,.pair-table td{padding:5px;border:1px solid #c4d0d8;text-align:center}.pair-table th{background:#ebf1f5;font-size:12px}.pair-table td:first-child{font-weight:800}.pair-table input{width:92px;max-width:100%;padding:8px 4px;background:#e8f4ff;border:1px solid #b2cadb;font-size:16px;text-align:right;border-radius:5px}.pair-check{font-size:14px;background:#fff6e6;padding:12px;margin:12px 0;border-radius:7px;display:flex;align-items:center;gap:8px}.pair-check input{width:19px;height:19px;flex-shrink:0}@media(max-width:450px){.pair-grid{grid-template-columns:1fr}}`;
document.head.appendChild(st);
const panel=`<div class="panel" id="pairPanel">
<h2>写真2枚をまとめて仮読取</h2>
<p class="small">前後それぞれ「タンク管理表＋右下のレシート」を貼った用紙を撮影します。数字の取り違えを防ぐため、この4セットと同じ4油種のタンク配置が前提です。OCR候補は自動確定しません。</p>
<div class="pair-grid">
<div><label>① 荷卸し前の用紙</label><input id="pairBefore" type="file" accept="image/*" capture="environment"><p id="beforeName" class="micro">未選択</p></div>
<div><label>② 荷卸し後の用紙</label><input id="pairAfter" type="file" accept="image/*" capture="environment"><p id="afterName" class="micro">未選択</p></div></div>
<div class="buttons" style="margin-top:10px"><button type="button" class="btn primary" id="pairRun">2枚から数字候補を抽出</button></div>
<p id="pairStatus" class="status" aria-live="polite">写真を2枚選んでください。撮影データはサーバーに送信しません。</p>
<details id="pairCropDetail"><summary><b>数字の切り出し位置を調整</b>（認識不足の場合）</summary><p class="small">各プレビューに数字4行が入るようにスライダーを調整して再実行します。候補は必ず原票と照合してください。</p><div id="pairCrops"></div></details>
<div id="pairCandidates" hidden><h3>OCR候補（紙と同じA・B・C・D・④）</h3>
<p class="cameraHelp">青い欄は仮の候補です。読み取りの弱い欄は空欄になり、自動的に正しい数字が入ったことにはなりません。</p>
<div class="pair-scroll"><table class="pair-table"><thead><tr><th>油種</th><th>A 前計算</th><th>B 前実在庫</th><th>C 後計算</th><th>D 後実在庫</th><th>④ 入荷数量</th></tr></thead><tbody id="pairBody"></tbody></table></div>
<label class="pair-check"><input id="pairConfirm" type="checkbox"> 4油種×5欄を原票と照合し、読み間違いを修正しました</label>
<div class="buttons"><button id="pairApply" type="button" class="btn primary">確認した数値を計算表に反映</button></div>
<p class="small">入荷なしの油種は④を0に設定。誤差率は空欄・判定は「—」（誤差の大きい場合は要確認）。</p>
</div></div>`;
document.querySelector('#photoView').insertAdjacentHTML('afterbegin',panel);
// The older 4-step single-photo OCR remains available as a fallback in the original app.
const original=document.getElementById('photoSteps');
if(original)original.closest('.panel').insertAdjacentHTML('afterbegin','<p class="small">旧方式：帳票を個別に撮影して候補を選択（2枚読み取りで不足した場合のみ）</p>');
function status(s){document.getElementById('pairStatus').textContent=s}
function parseNumbers(text){
 const out=[];
 for(const line of String(text||'').split(/\r?\n/)){
  // Commas are important: the small numbers in the date/time are not inventory quantities.
  for(const match of (line.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{4,6}(?:\.\d+)?/g)||[])){
   const n=Number(match.replace(/,/g,''));
   if(Number.isFinite(n)&&n>=1000&&n<100000&&Number.isInteger(n))out.push(n);
  }
 }
 return out;
}
async function fileCanvas(file){
 const url=URL.createObjectURL(file);
 try{return await new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>{
   const s=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
   const can=document.createElement('canvas');can.width=Math.max(1,Math.round(img.naturalWidth*s));can.height=Math.max(1,Math.round(img.naturalHeight*s));
   can.getContext('2d').drawImage(img,0,0,can.width,can.height);resolve(can);
  };img.onerror=()=>reject(new Error('写真を開けませんでした'));img.src=url;
 })}finally{URL.revokeObjectURL(url)}
}
function cropPhoto(cfg){
 const src=photoCanvases[cfg.side];if(!src)return null;
 const [x,y,w,h]=cfg.rect;
 const sx=Math.max(0,Math.round(src.width*x/100)),sy=Math.max(0,Math.round(src.height*y/100));
 const sw=Math.max(10,Math.min(src.width-sx,Math.round(src.width*w/100))),sh=Math.max(10,Math.min(src.height-sy,Math.round(src.height*h/100)));
 const can=document.createElement('canvas');can.width=sw*3;can.height=sh*3;
 const c=can.getContext('2d',{willReadFrequently:true});c.filter='contrast(140%) grayscale(100%)';
 c.drawImage(src,sx,sy,sw,sh,0,0,can.width,can.height);return can;
}
function drawCrop(cfg){const target=document.getElementById('crop-'+cfg.id),src=cropPhoto(cfg);if(!target)return;if(!src){target.width=1;target.height=1;return}target.width=src.width;target.height=src.height;target.getContext('2d').drawImage(src,0,0)}
function renderCrops(){
 document.getElementById('pairCrops').innerHTML=configs.map(c=>`<div class="pair-config"><b>${c.name}</b><div class="mini-controls"><label>左右位置<input type="range" data-id="${c.id}" data-part="0" min="10" max="85" value="${c.rect[0]}"></label><label>上下位置<input type="range" data-id="${c.id}" data-part="1" min="5" max="86" value="${c.rect[1]}"></label><label>切り出し高さ<input type="range" data-id="${c.id}" data-part="3" min="6" max="35" value="${c.rect[3]}"></label></div><canvas id="crop-${c.id}" class="pair-crop"></canvas><span id="cropStatus-${c.id}" class="micro">未読取</span></div>`).join('');
 for(const input of document.querySelectorAll('#pairCrops input[type=range]'))input.addEventListener('input',()=>{const cfg=configs.find(c=>c.id===input.dataset.id);cfg.rect[Number(input.dataset.part)]=Number(input.value);drawCrop(cfg)});
 configs.forEach(drawCrop);
}
function renderDrafts(){
 document.getElementById('pairCandidates').hidden=false;
 document.getElementById('pairBody').innerHTML=order.map(([oil])=>`<tr><td>${oil}</td>${fields.map(k=>`<td><input type="text" data-oil="${oil}" data-field="${k}" inputmode="numeric" value="${drafts[oil][k]}" aria-label="${oil} ${k}"></td>`).join('')}</tr>`).join('');
 for(const input of document.querySelectorAll('#pairBody input'))input.addEventListener('input',()=>{drafts[input.dataset.oil][input.dataset.field]=input.value;document.getElementById('pairConfirm').checked=false});
}
function mapIfComplete(field,values){
 if(values.length!==4)return false;
 // Values are only suggestions, never persisted until all cells are checked.
 for(let i=0;i<4;i++)drafts[order[i][0]][field]=String(values[i]);return true;
}
async function getWorker(){
 if(!window.Tesseract)throw new Error('OCRライブラリ未読込。Safariで通信状態を確認してください。');
 if(!worker)worker=await Tesseract.createWorker('eng',1,{logger:()=>{}});
 await worker.setParameters({tessedit_char_whitelist:'0123456789.,- ',tessedit_pageseg_mode:'6'});
 return worker;
}
async function startPair(){
 if(running)return;
 if(!fileMap.before||!fileMap.after){alert('前後2枚の写真を選択してください');return}
 running=true;document.getElementById('pairRun').disabled=true;
 for(const [oil] of order)drafts[oil]={A:'',B:'',C:'',D:'',Q:''};
 document.getElementById('pairConfirm').checked=false;
 try{
  status('画像を読み込み中…');for(const k of ['before','after'])photoCanvases[k]=await fileCanvas(fileMap[k]);
  renderCrops();const t=await getWorker();let success=0;
  for(let i=0;i<configs.length;i++){
   const cfg=configs[i],crop=cropPhoto(cfg);status(`OCR中 ${i+1}/5：${cfg.name}`);
   try{const res=await t.recognize(crop),values=parseNumbers(res.data.text);
    states[cfg.id]={values,raw:res.data.text};const complete=mapIfComplete(cfg.field,values);
    if(complete)success++;
    document.getElementById('cropStatus-'+cfg.id).textContent=complete?'候補4件：'+values.join('・'):'4件揃わず未反映。候補：'+(values.join('・')||'なし');
   }catch(e){document.getElementById('cropStatus-'+cfg.id).textContent='認識失敗：'+e.message}
  }
  renderDrafts();status(`OCR終了：5項目中${success}項目に4件の候補。全20セルを原票と照合して修正してください。`);
  document.getElementById('pairCandidates').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){status('処理失敗：'+e.message+'。手入力画面から入力できます。')}
 finally{running=false;document.getElementById('pairRun').disabled=false}
}
for(const side of ['before','after'])document.getElementById(side==='before'?'pairBefore':'pairAfter').addEventListener('change',e=>{
 fileMap[side]=e.target.files?.[0]||null;photoCanvases[side]=null;
 document.getElementById(side+'Name').textContent=fileMap[side]?.name||'未選択';document.getElementById('pairConfirm').checked=false;
});
document.getElementById('pairRun').addEventListener('click',startPair);
document.getElementById('pairApply').addEventListener('click',()=>{
 if(!document.getElementById('pairConfirm').checked){alert('原票と20欄を照合して確認欄にチェックを入れてください');return}
 for(const [oil] of order){for(const k of fields){const n=Number(normalize(drafts[oil][k]));if(!valid(drafts[oil][k])||n<0){alert(oil+'の'+k+'欄に未入力または不正な数字があります。');return}}}
 for(const [oil,idx,capacity] of order){tanks[idx].oil=oil;tanks[idx].capacity=capacity;for(const k of fields)tanks[idx][k]=normalize(drafts[oil][k])}
 save();changeTank(0);renderPaper();tab('paper');alert('20欄の確認済み数字を計算表に反映しました。紙へ転記する前にも元帳票を確認してください。');
});
window.eneosPairTest={parseNumbers,configs,mapIfComplete};
})();