'use strict';
// Four physical tanks used by this store; rows 4-9 remain blank in the paper form.
const FIXED_TANKS=[
 {no:1,capacity:'14KL',oil:'H',name:'ハイオク'},
 {no:2,capacity:'48KL',oil:'R',name:'レギュラー'},
 {no:3,capacity:'14KL',oil:'D',name:'軽油'},
 {no:10,capacity:'20KL',oil:'K',name:'灯油'}
];
const STAGES=[
 {field:'A',short:'前POS',title:'荷卸し前の計算在庫',source:'荷卸し前のタンク管理表',hint:'POSから印刷された「タンク管理表」の計算在庫欄を見ながら、H・R・D・Kの順番に入力します。'},
 {field:'B',short:'前レシート',title:'荷卸し前の実在庫',source:'荷卸し前の在庫レシート',hint:'ローリー到着直後に印刷した、用紙右下の「在庫量（L）」から入力します。'},
 {field:'C',short:'後POS',title:'荷卸し後の計算在庫',source:'荷卸し後のタンク管理表',hint:'受け入れ完了後、POSから印刷されたタンク管理表の計算在庫欄から入力します。'},
 {field:'D',short:'後レシート',title:'荷卸し後の実在庫',source:'荷卸し後の在庫レシート',hint:'受け入れが終わってからもう一度印刷した、用紙右下の「在庫量（L）」から入力します。'},
 {field:'Q',short:'入荷数量',title:'今回入荷数量 ④',source:'荷卸し後のタンク管理表「当日入荷」',hint:'実際の入荷数量をタンク別に入力します。入荷がなかった油種は「0」と入力してください。'}
];
const STORAGE_KEY='fuel-check-manual-v3';
function defaults(){return FIXED_TANKS.map(t=>({no:t.no,oil:t.oil,name:t.name,capacity:t.capacity,A:'',B:'',C:'',D:'',Q:''}));}
function cleanDigits(input){
 const v=String(input??'').trim().replace(/[０-９]/g,ch=>String(ch.charCodeAt(0)-65296)).replace(/[，,\s]/g,'');
 if(/^\d+\.0+$/.test(v))return v.split('.')[0];
 return v.replace(/[^0-9]/g,'');
}
function number(v){return /^\d+$/.test(String(v??''))?Number(v):null;}
function calc(t){
 const a=number(t.A),b=number(t.B),c=number(t.C),d=number(t.D),q=number(t.Q);
 const one=a!==null&&b!==null?b-a:null;
 const two=c!==null&&d!==null?d-c:null;
 const three=one!==null&&two!==null?two-one:null;
 const rate=three!==null&&q!==null&&q>0?three/q:null;
 const lim=t.oil==='K'?100:400;
 const complete=!!t.oil&&a!==null&&b!==null&&c!==null&&d!==null&&q!==null&&q>=0;
 const bad=complete&&three!==null&& (Math.abs(three)>=lim||(q>0&&Math.abs(rate)>=.025));
 const state=!complete?'要入力':bad?'×':q===0?'—':'○';
 return {one,two,three,q,rate,lim,complete,bad,state};
}
function numberText(n){return n===null||n===undefined?'—':Number(n).toLocaleString('ja-JP',{maximumFractionDigits:3});}
function numberOrDash(v){return number(v)===null?'—':numberText(number(v));}
let tanks=defaults(),stageIndex=0,activeTab='entry',loadedOld=false;
function loadStored(){
 try{
  const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(!Array.isArray(stored)||stored.length!==4)return;
  tanks=FIXED_TANKS.map((base,i)=>{
   const s=stored[i]||{};
   const row={...base,A:'',B:'',C:'',D:'',Q:''};
   for(const f of ['A','B','C','D','Q'])row[f]=cleanDigits(s[f]);
   return row;
  });
  loadedOld=tanks.some(t=>STAGES.some(s=>t[s.field]!==''));
 }catch(e){tanks=defaults();}
}
function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(tanks));}catch(e){}
}
function filledCount(){return tanks.reduce((sum,t)=>sum+STAGES.filter(s=>t[s.field]!=='').length,0);}
function stageCount(field){return tanks.filter(t=>t[field]!=='').length;}
function showOldBanner(){document.getElementById('oldData').hidden=!loadedOld;}
function renderProgress(){
 document.getElementById('progress').textContent=filledCount()+' / 20欄';
 const nav=document.getElementById('stageNav');
 nav.innerHTML='';
 STAGES.forEach((s,i)=>{
  const btn=document.createElement('button');btn.type='button';btn.dataset.field=s.field;
  if(i===stageIndex)btn.classList.add('active');
  if(stageCount(s.field)===4)btn.classList.add('done');
  btn.setAttribute('aria-label',s.title);
  const strong=document.createElement('b');strong.textContent=s.field==='Q'?'④':s.field;
  const span=document.createElement('span');span.textContent=s.short;
  btn.append(strong,span);btn.addEventListener('click',()=>selectStage(i,true));nav.appendChild(btn);
 });
}
function setField(rowIndex,field,val){
 const clean=cleanDigits(val);tanks[rowIndex][field]=clean;
 save();renderProgress();
}
function renderStage(){
 const cfg=STAGES[stageIndex];
 const card=document.getElementById('stageCard');card.dataset.field=cfg.field;
 document.getElementById('stageTag').textContent=cfg.field==='Q'?'④':cfg.field;
 document.getElementById('stageTitle').textContent=cfg.title;
 document.getElementById('stageSource').textContent=cfg.source;
 document.getElementById('stageHint').textContent=cfg.hint;
 const holder=document.getElementById('stageInputs');holder.replaceChildren();
 for(let i=0;i<tanks.length;i++){
  const t=tanks[i],r=document.createElement('div');r.className='input-row';
  const left=document.createElement('div');left.className='input-desc';
  const heading=document.createElement('strong');heading.textContent='タンク '+t.no+'　'+t.oil+'（'+t.name+'）';
  const sub=document.createElement('span');sub.textContent=t.capacity+(t.oil==='K'?' ／レシートでは4行目':'');
  left.append(heading,sub);
  const inp=document.createElement('input');
  inp.type='text';inp.inputMode='numeric';inp.pattern='[0-9]*';
  inp.autocomplete='off';inp.spellcheck=false;inp.enterKeyHint=i===tanks.length-1?'done':'next';
  inp.placeholder='数字を入力';inp.value=t[cfg.field]||'';
  inp.id='num-'+cfg.field+'-'+t.no;inp.setAttribute('aria-label',heading.textContent+' '+cfg.title+'（L）');
  inp.addEventListener('input',()=>{
   const before=inp.value;
   const position=inp.selectionStart??before.length;
   const cleaned=cleanDigits(before);
   if(before!==cleaned)inp.value=cleaned;
   setField(i,cfg.field,inp.value);
  });
  inp.addEventListener('keydown',e=>{
   if(e.key==='Enter'){
    e.preventDefault();
    if(i<tanks.length-1)holder.querySelectorAll('input')[i+1].focus();
    else if(stageIndex<STAGES.length-1)selectStage(stageIndex+1,true);
    else showTab('paper');
   }
  });
  r.append(left,inp);holder.appendChild(r);
 }
 const prev=document.getElementById('prevStage'),next=document.getElementById('nextStage');
 prev.disabled=stageIndex===0;
 next.textContent=stageIndex===STAGES.length-1?'計算結果を見る →':'次の帳票 →';
 renderProgress();
}
function selectStage(i,focus=false){
 stageIndex=Math.max(0,Math.min(STAGES.length-1,Number(i)));
 if(activeTab!=='entry')showTab('entry');
 else renderStage();
 if(focus){
  const inputs=[...document.querySelectorAll('#stageInputs input')];
  const first=inputs.find(x=>x.value==='')||inputs[0];
  if(first)first.focus({preventScroll:true});
 }
}
function showTab(tab){
 activeTab=tab;
 for(const k of ['entry','paper','guide']){
  const selected=k===tab;
  document.getElementById(k+'View').hidden=!selected;
  const button=document.getElementById('tab-'+k);
  button.classList.toggle('active',selected);
  button.setAttribute('aria-current',selected?'page':'false');
 }
 if(tab==='entry')renderStage();
 if(tab==='paper')renderPaper();
 if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'auto'});
}
function paintCell(text,className){
 const td=document.createElement('td');td.textContent=text;
 if(className)td.className=className;
 return td;
}
function renderPaper(){
 const tbody=document.getElementById('paperBody');tbody.replaceChildren();
 const full=Array.from({length:10},(_,i)=>tanks.find(t=>t.no===i+1)||null);
 let bad=0,pending=0;
 for(let i=0;i<full.length;i++){
  const t=full[i],tr=document.createElement('tr');
  tr.appendChild(paintCell(String(i+1)));
  if(!t){for(let j=1;j<14;j++)tr.appendChild(paintCell(''));tbody.appendChild(tr);continue;}
  const r=calc(t);
  if(r.bad)bad++;else if(!r.complete)pending++;
  const items=[
   [t.capacity,''],[t.oil,''],
   [numberOrDash(t.A),'col-a'],[numberOrDash(t.B),'col-b'],[numberText(r.one),''],
   [numberOrDash(t.C),'col-c'],[numberOrDash(t.D),'col-d'],[numberText(r.two),''],
   [numberText(r.three),''],[r.rate===null?'—':(r.rate*100).toFixed(2)+'%',''],
   ['±'+r.lim+'L または ±2.5%',''],[r.state,r.bad?'bad':r.state==='要入力'?'wait':''],
   [numberOrDash(t.Q),'col-q']
  ];
  for(const [val,cls] of items)tr.appendChild(paintCell(val,cls));
  tr.addEventListener('click',()=>selectStage(0));
  tbody.appendChild(tr);
 }
 document.getElementById('judgementSummary').textContent=bad?'× '+bad+'件':pending?'未入力 '+pending+'油種':'範囲外なし';
 const cards=document.getElementById('mobilePaper');cards.replaceChildren();
 for(let i=0;i<tanks.length;i++){
  const t=tanks[i],r=calc(t),card=document.createElement('div');card.className='paper-card';
  const title=document.createElement('h3');title.textContent='タンク'+t.no+'　'+t.oil+'（'+t.name+'）';
  const status=document.createElement('span');status.className='paper-status'+(r.bad?' bad':!r.complete?' pending':'');
  status.textContent=r.state;title.appendChild(status);card.appendChild(title);
  const grid=document.createElement('div');grid.className='paper-values';
  const values=[
   ['A 荷卸し前 計算在庫',numberOrDash(t.A),'a'],
   ['B 荷卸し前 実在庫',numberOrDash(t.B),'b'],
   ['① B−A',numberText(r.one),''],
   ['C 荷卸し後 計算在庫',numberOrDash(t.C),'c'],
   ['D 荷卸し後 実在庫',numberOrDash(t.D),'d'],
   ['② D−C',numberText(r.two),''],
   ['③ ②−①',numberText(r.three),''],
   ['④ 今回入荷数量',numberOrDash(t.Q),'q'],
   ['誤差率',r.rate===null?'—':(r.rate*100).toFixed(2)+'%',''],
   ['許容範囲','±'+r.lim+'L または ±2.5%','']
  ];
  for(const [label,n,vClass] of values){
   const c=document.createElement('div');c.className=vClass;
   const small=document.createElement('span');small.textContent=label;
   const strong=document.createElement('b');strong.textContent=n;
   c.append(small,strong);grid.appendChild(c);
  }
  card.appendChild(grid);card.addEventListener('click',()=>selectStage(0));cards.appendChild(card);
 }
}
function clearAll(){
 if(!confirm('現在の入力数字をすべて消去して、新しい検証を始めます。よろしいですか？'))return;
 tanks=defaults();stageIndex=0;loadedOld=false;save();showOldBanner();showTab('entry');
}
function init(){
 loadStored();showOldBanner();
 document.getElementById('prevStage').addEventListener('click',()=>selectStage(stageIndex-1,true));
 document.getElementById('nextStage').addEventListener('click',()=>{if(stageIndex===STAGES.length-1)showTab('paper');else selectStage(stageIndex+1,true);});
 document.getElementById('newTop').addEventListener('click',clearAll);
 document.getElementById('newFromGuide').addEventListener('click',clearAll);
 document.getElementById('bottomEntry').addEventListener('click',()=>showTab('entry'));
 document.getElementById('bottomPaper').addEventListener('click',()=>showTab('paper'));
 for(const k of ['entry','paper','guide'])document.getElementById('tab-'+k).addEventListener('click',()=>showTab(k));
 showTab('entry');
}
if(typeof module!=='undefined'&&module.exports)module.exports={calc,cleanDigits,defaults,FIXED_TANKS,STAGES,number};
if(typeof document!=='undefined')init();
