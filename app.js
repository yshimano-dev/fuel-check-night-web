'use strict';
const STORAGE='fuel-check-workflow-v1';
const STAFF_LOCAL_KEY='fuel-check-local-staff-v1';
const FUELS=[['H','H｜ハイオク'],['R','R｜レギュラー'],['D','D｜軽油'],['K','K｜灯油'],['OTHER','その他／廃油など']];
const DEFAULT_CHECKS={preReceipt:false,prePos:false,unloading:false,postReceipt:false,posEntered:false,postPos:false,paperSaved:false};
const FIELDS=['A','B','C','D','Q'];
function fuelLimit(oil){return oil==='K'?{liters:100,percent:2.5}:['H','R','D'].includes(oil)?{liters:400,percent:2.5}:null;}
function ito(){return {id:'ito',name:'DDセルフ伊都店',pos:'ENERIS',posCardName:'入庫（JX日光）',posCardNo:'2',tanks:[
 {no:1,capacity:'14KL',oil:'H'}, {no:2,capacity:'48KL',oil:'R'},
 {no:3,capacity:'14KL',oil:'D'}, {no:10,capacity:'20KL',oil:'K'}
]};}
function cleanDigits(v){
 let s=String(v??'').trim().replace(/[０-９]/g,ch=>String(ch.charCodeAt(0)-65296));
 if(/^[0-9,]+\.0+$/.test(s))s=s.replace(/\.0+$/,'');
 return /^[0-9,]*$/.test(s)?s.replace(/,/g,''):null;
}
function value(v){return typeof v==='string'&&/^\d+$/.test(v)?Number(v):null;}
function calculate(t,e){
 const a=value(e?.A),b=value(e?.B),c=value(e?.C),d=value(e?.D),q=value(e?.Q);
 const one=a!==null&&b!==null?b-a:null,two=c!==null&&d!==null?d-c:null;
 const delta=one!==null&&two!==null?two-one:null;
 const rate=delta!==null&&q!==null&&q>0?delta/q:null;
 const known=fuelLimit(t.oil);
 const limit=known|| (t.oil==='OTHER'&&Number(t.limitL)>0&&Number(t.limitPct)>0?{liters:Number(t.limitL),percent:Number(t.limitPct)}:null);
 let state='未入力';
 const complete=[a,b,c,d,q].every(v=>v!==null);
 if(complete&&!limit)state='基準未設定';
 else if(complete&&limit&&q<0)state='要確認';
 else if(complete&&limit){
  const bad=Math.abs(delta)>=limit.liters || (q>0&&Math.abs(rate)*100>=limit.percent);
  state=bad?'×':q===0?'入荷なし':'○';
 }
 return {one,two,delta,rate,state,limit,complete,q};
}
function nfmt(n){return n===null||n===undefined?'—':Number(n).toLocaleString('ja-JP',{maximumFractionDigits:2});}
function formatInput(s){const v=value(s);return v===null?'—':nfmt(v);}
function sanitizeStore(st){
 if(!st||typeof st!=='object')return null;
 const name=String(st.name||'店舗').trim().slice(0,40)||'店舗';
 const pos=st.pos==='POS21'?'POS21':'ENERIS';
 const nameDefault=st.id==='ito'&&st.posCardName===undefined?'入庫（JX日光）':'';
 const noDefault=st.id==='ito'&&st.posCardNo===undefined?'2':'';
 const posCardName=String(st.posCardName??nameDefault).trim().slice(0,70);
 const candidate=String(st.posCardNo??noDefault).trim();
 const posCardNo=/^\d{1,5}$/.test(candidate)?candidate:'';
 const list=Array.isArray(st.tanks)?st.tanks:[];
 if(list.length<1||list.length>20)return null;
 const tanks=[],ids=new Set();
 for(const raw of list){
  const no=Number(raw.no),capacity=String(raw.capacity||'').slice(0,12);
  const oil=FUELS.some(x=>x[0]===raw.oil)?raw.oil:'OTHER';
  if(!Number.isInteger(no)||no<1||no>30||ids.has(no))return null;
  ids.add(no);
  const t={no,capacity,oil};
  if(oil==='OTHER'){
   t.limitL=Number(raw.limitL)>0?Number(raw.limitL):null;
   t.limitPct=Number(raw.limitPct)>0?Number(raw.limitPct):null;
  }
  tanks.push(t);
 }
 tanks.sort((a,b)=>a.no-b.no);
 return {id:String(st.id||'s'+Date.now()),name,pos,posCardName,posCardNo,tanks};
}
function blankSession(){return {values:{},checks:{...DEFAULT_CHECKS},createdAt:Date.now()};}
// 正式に登録された店舗だけを表示する。公開Webページからの新規店舗作成は行わない。
function approvedStores(){
 const entries=typeof window!=='undefined'&&Array.isArray(window.FUEL_APPROVED_STORES)
  ? window.FUEL_APPROVED_STORES : [ito()];
 const seen=new Set(),result=[];
 for(const input of entries){
  const st=sanitizeStore(input);
  if(st&&!seen.has(st.id)){seen.add(st.id);result.push(st);}
 }
 return result.length?result:[sanitizeStore(ito())];
}
let state={stores:approvedStores(),active:'ito',sessions:{ito:blankSession()},cardOverrides:{}};
function load(){
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem(STORAGE)||'null')}catch(e){}
 const official=approvedStores();
 const ids=new Set(official.map(s=>s.id));
 const overrides={};
 for(const st of official){
  const explicit=saved?.cardOverrides?.[st.id];
  const prior=Array.isArray(saved?.stores)?saved.stores.find(t=>t.id===st.id):null;
  // 前バージョンで変更していたカード設定だけ移行。タンク・店舗名は管理者登録を優先。
  const local=explicit||prior;
  if(local&&(typeof local.posCardName==='string'||typeof local.posCardNo==='string')){
   const name=String(local.posCardName??st.posCardName).trim().slice(0,70);
   const num=String(local.posCardNo??st.posCardNo).trim();
   overrides[st.id]={posCardName:name,posCardNo:/^\d{1,5}$/.test(num)?num:''};
  }
 }
 const stores=official.map(s=>({...s,...(overrides[s.id]||{})}));
 const active=ids.has(saved?.active)?saved.active:stores[0].id;
 const sessions=(saved?.sessions&&typeof saved.sessions==='object')?saved.sessions:{};
 state={stores,active,sessions,cardOverrides:overrides};
 if(!state.sessions[state.active])state.sessions[state.active]=blankSession();
 // 未承認のローカル店舗や旧LINE登録リンクは選択に入れない。
}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}}
function activeStore(){return state.stores.find(x=>x.id===state.active)||state.stores[0];}
function session(){if(!state.sessions[state.active])state.sessions[state.active]=blankSession();return state.sessions[state.active];}
function getEntry(t){const key=String(t.no);const s=session();if(!s.values[key])s.values[key]={A:'',B:'',C:'',D:'',Q:''};return s.values[key];}
function el(id){return document.getElementById(id);}
function make(tag,cls,text){
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;return node;
}
function renderStoreSelect(){
 const sel=el('storeSelect');sel.replaceChildren();
 for(const s of state.stores){const option=make('option','',s.name);option.value=s.id;sel.append(option);}
 sel.value=state.active;
}
function updateStore(mut){
 const current=activeStore();
 mut(current);
 // 他の店舗・タンク・判定基準を上書きできないよう、カード名と選択番号だけ保存。
 const name=String(current.posCardName||'').trim().slice(0,70);
 const num=String(current.posCardNo||'').trim();
 state.cardOverrides[state.active]={posCardName:name,posCardNo:/^\d{1,5}$/.test(num)?num:''};
 state.stores=approvedStores().map(s=>({...s,...(state.cardOverrides[s.id]||{})}));
 save();renderAll();
}
function readStaffCode(storeId){
 try{
  const all=JSON.parse(localStorage.getItem(STAFF_LOCAL_KEY)||'{}');
  const value=all?.[storeId];
  return typeof value==='string'&&/^\d{1,12}$/.test(value)?value:'';
 }catch(e){return ''}
}
function writeStaffCode(storeId,raw){
 const code=cleanDigits(raw);
 if(code===null||(!/^\d{1,12}$/.test(code)&&code!==''))return false;
 try{
  const all=JSON.parse(localStorage.getItem(STAFF_LOCAL_KEY)||'{}');
  if(code)all[storeId]=code;else delete all[storeId];
  localStorage.setItem(STAFF_LOCAL_KEY,JSON.stringify(all));
  return true;
 }catch(e){return false}
}
function flowRow(id,heading,items){
 const root=el(id);root.replaceChildren();
 root.append(make('h3','',heading));
 const path=make('div','path');
 items.forEach((item,i)=>{
  if(i)path.append(make('span','arrow','→'));
  const chip=make('a','click'+(item.important?' emphasized':''),item.label);
  chip.href=item.href;
  if(item.href==='#quickCodeEditor')chip.addEventListener('click',e=>{e.preventDefault();openQuickCodeEditor();});
  if(item.href==='#quickCardEditor')chip.addEventListener('click',e=>{e.preventDefault();openQuickCardEditor();});
  path.append(chip);
 });
 root.append(path);
}
function openQuickCardEditor(){
 if(activeStore().pos!=='ENERIS')return;
 const st=activeStore();
 el('quickCardName').value=st.posCardName||'';
 el('quickCardNo').value=st.posCardNo||'';
 const box=el('quickCardEditor');box.hidden=false;
 box.scrollIntoView({behavior:'smooth',block:'center'});
 el('quickCardName').focus({preventScroll:true});
}
function saveQuickCard(){
 const name=el('quickCardName').value.trim();
 const num=el('quickCardNo').value.trim().replace(/[０-９]/g,ch=>String(ch.charCodeAt(0)-65296));
 if(!name||!/^\d{1,5}$/.test(num)){
  alert('「POSのカード名称」と「カード一覧で選ぶ番号（1〜5桁）」の両方を入力してください。');
  return;
 }
 updateStore(st=>{st.posCardName=name;st.posCardNo=num;});
 el('quickCardEditor').hidden=true;
}
function openQuickCodeEditor(){
 const editor=el('quickCodeEditor');
 editor.hidden=false;
 el('quickCodeInput').value=readStaffCode(activeStore().id);
 editor.scrollIntoView({behavior:'smooth',block:'center'});
 el('quickCodeInput').focus({preventScroll:true});
}
function saveQuickCode(){
 const st=activeStore(),raw=el('quickCodeInput').value;
 if(raw.trim()&&!/^\d{1,12}$/.test(raw.trim())){
  alert('担当者コードは12桁以内の数字で入力してください。');
  return;
 }
 if(!writeStaffCode(st.id,raw.trim())){
  alert('この端末に保存できませんでした。Safariの保存設定を確認してください。');
  return;
 }
 el('quickCodeEditor').hidden=true;
 renderPos();renderQuickFlow();
}
function renderQuickFlow(){
 const st=activeStore(),pos=st.pos,code=readStaffCode(st.id);
 el('quickStoreName').textContent=st.name;
 el('quickPosType').textContent=(pos==='ENERIS'?'ENERIS-POS':'POS21')+' ／ POS操作フローと入庫の順番';
 flowRow('quickBefore','① 受け入れ前',[
  {label:'到着したらレシート印字',href:'#step1',important:true},
  {label:'前POS タンク管理表',href:'#step2'},
  {label:'A・Bの数字入力',href:'#step3'}
 ]);
 if(pos==='ENERIS'){
  const name=st.posCardName||'カード名称未設定';
  const no=st.posCardNo?st.posCardNo+'番を選択':'選択番号未設定';
  flowRow('quickAfter','② 受け入れ後',[
   {label:'レシート再印字',href:'#step5',important:true},
   {label:'POS → 入庫',href:'#step6'},
   {label:'転受カード一覧',href:'#step6'},
   {label:'カード名称 '+name,href:'#quickCardEditor'},
   {label:no+'（タップして変更）',href:'#quickCardEditor',important:true},
   {label:'店受けカード一覧',href:'#step6'},
   {label:'担当者コード '+(code||'未登録'),href:'#quickCodeEditor',important:true},
   {label:'油種・タンクNo.・数量（必要な分だけ繰り返す）→後POS印刷',href:'#step6'},
   {label:'C・D・④入力 → 判定',href:'#step7'}
  ]);
 }else{
  flowRow('quickAfter','② 受け入れ後',[
   {label:'レシート再印字',href:'#step5',important:true},
   {label:'POS21 → 仕入',href:'#step6'},
   {label:'油種・タンクNo.・数量',href:'#step6'},
   {label:'担当者コード '+(code||'未登録'),href:'#quickCodeEditor'},
   {label:'後POS印刷 → C・D・④入力',href:'#step7'},
   {label:'判定',href:'#step8'}
  ]);
 }
 const cardBox=el('quickCardSelect');
 cardBox.hidden=pos!=='ENERIS';
 el('quickCardValue').textContent=st.posCardName&&st.posCardNo?
  'カード名称「'+st.posCardName+'」／ '+st.posCardNo+'番を選択':'カード名称または選択番号が未設定';
 el('quickCardName').value=st.posCardName||'';
 el('quickCardNo').value=st.posCardNo||'';
 el('quickCardEditor').hidden=true;
 el('quickCodeValue').textContent=code||'未登録（初回のみ設定）';
 const edit=el('quickCodeEditor');edit.hidden=true;
 el('quickCodeInput').value=code;
 const field=el('staffCode');
 if(field){field.value=code;field.type='text';field.readOnly=true;}
 const toggle=el('toggleStaffCode');if(toggle)toggle.textContent='変更';
}
function renderPos(){
 const store=activeStore(),pos=store.pos;
 const chosenName=store.posCardName||'未設定（店舗設定で登録）';
 const chosenNo=store.posCardNo?store.posCardNo+'番':'未設定（店舗設定で登録）';
 const pre=pos==='ENERIS'?['メインメニュー','点検','SS営業日報管理','タンク管理表','当日分','印刷']:
 ['メインメニュー','点検／問合せ','タンク管理','印刷','レシート出力'];
 const post=pos==='ENERIS'?[
 'メインメニュー','通常','入出荷業務','入庫','転受カード一覧',
 'カード名称：'+chosenName,'一覧の選択番号：'+chosenNo,
 '店受けカード一覧','担当者コード：'+(readStaffCode(store.id)||'未登録（上部の店舗フローで設定）'),'商品パネル','油種選択','タンクNo.','数量','単価は削除・金額は未入力'
 ]:[
 'メインメニュー','伝票入力','仕入','仕入先選択',
 'エネオス','確定（2回）','タンクNo.と数量のみ入力','油種選択（必要なら繰り返す）'
 ];
 el('prePosTitle').textContent=pos==='ENERIS'?'ENERIS-POS：荷卸し前のタンク管理表':'POS21：荷卸し前のタンク管理表';
 renderPath('prePosPath',pre);
 renderPath('postPosPath',post);
 const repeat=el('posRepeatTip');if(repeat){repeat.hidden=pos!=='ENERIS';}
 renderPath('postReportPath',pre);
 const hint=el('posSelectionHint');
 hint.textContent=pos==='ENERIS'?
 ('この店舗で選ぶカード：'+chosenName+'／選択番号：'+chosenNo+
  '。担当者コードは下欄に入力（共有リンクには含まれません）。'):
 'POS21用の操作案内です。カード選択や担当者コードは店舗の正式設定を確認してください。';
 hint.classList.toggle('needs-config',pos==='ENERIS'&&(!store.posCardName||!store.posCardNo));
 el('posNote').textContent=pos==='ENERIS'?
 'ENEOSの2026年10月15日版マニュアル16〜21ページの画面順を参考にしています。入庫カードの名称・番号は店舗ごとに異なるため、事前に店舗設定で登録してください。別のタンク・油種も入荷する場合は、商品パネルに戻ってタンクごとに油種・タンクNo.・数量の入力を繰り返します。':
 'ENEOSの2026年10月15日版マニュアル4〜9ページの画面順を参考にしています。スタッフコードの入力や仕入先の選択は店舗の正式な手順を確認してください。';
 const code=el('staffCode');
 if(code){code.value=readStaffCode(store.id);code.type='text';code.readOnly=true;}
 const toggle=el('toggleStaffCode');if(toggle)toggle.textContent='変更';
}
function renderPath(id,steps){
 const root=el(id);root.replaceChildren();
 steps.forEach((s,i)=>{if(i)root.append(make('span','arrow','→'));root.append(make('span','click',s));});
}

function updateValue(tankNo,field,raw,node){
 const cleaned=cleanDigits(raw);
 if(cleaned===null){
  node.value=getEntry({no:tankNo})[field]||'';
  el('settingsMessage').textContent='整数のリットル数を入力してください（小数をそのままつなげて入力しません）。';
  return;
 }
 const entry=getEntry({no:tankNo});entry[field]=cleaned;
 save();updateProgress();renderResults();
}
function renderInputFields(){
 for(const f of FIELDS){
  const root=el('inputs'+f);root.replaceChildren();
  const tanks=activeStore().tanks;
  tanks.forEach((t,i)=>{
   const row=make('div','fuel-input'),info=make('div','info');
   const name=FUELS.find(x=>x[0]===t.oil)?.[1]||'その他';
   info.append(make('strong','','No.'+t.no+'　'+name));
   info.append(make('small','',(t.capacity||'容量未設定')+(t.oil==='K'?' ／レシートの灯油行を確認':'')));
   const input=make('input');input.type='text';input.inputMode='numeric';input.pattern='[0-9]*';
   input.autocomplete='off';input.spellcheck=false;input.enterKeyHint=i<tanks.length-1?'next':'done';
   input.setAttribute('aria-label','タンク'+t.no+' '+f+' の数量（L）');
   input.placeholder='数字を入力';input.value=getEntry(t)[f]||'';
   input.dataset.field=f;input.dataset.tank=String(t.no);
   input.addEventListener('input',()=>{const old= input.value;updateValue(t.no,f,old,input);
    const cleaned=cleanDigits(old);if(cleaned!==null&&cleaned!==old)input.value=cleaned;
   });
   input.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;
    e.preventDefault();
    const next=root.querySelectorAll('input')[i+1];
    if(next)next.focus();
    else {input.blur();const seq=['A','B','C','D','Q'];const following=seq[seq.indexOf(f)+1];if(following)el('inputs'+following).scrollIntoView({behavior:'smooth',block:'center'});else el('step8').scrollIntoView({behavior:'smooth'});}
   });
   row.append(info,input);root.append(row);
  });
 }
}
function renderResults(){
 const root=el('results');root.replaceChildren();
 let all=true,hasBad=false,hasNoLimit=false;
 const tanks=activeStore().tanks;
 for(const t of tanks){
  const e=getEntry(t),v=calculate(t,e);
  if(!['○','入荷なし'].includes(v.state))all=false;
  if(v.state==='×')hasBad=true;
  if(v.state==='基準未設定')hasNoLimit=true;
  const c=make('div','result');
  const heading=make('h3','');
  heading.append(make('span','','No.'+t.no+'　'+(FUELS.find(x=>x[0]===t.oil)?.[1]||'その他')));
  const badge=make('span','state'+(v.state==='×'?' bad':!['○','入荷なし'].includes(v.state)?' pending':''),v.state);
  heading.append(badge);c.append(heading);
  const content=make('div','numbers');
  const fields=[
   ['① B−A',nfmt(v.one)],['② D−C',nfmt(v.two)],
   ['③ 誤差数量',nfmt(v.delta)+' L'],
   ['誤差率',v.rate===null?'—':(100*v.rate).toFixed(2)+'%'],
   ['数量基準',v.limit?'±'+nfmt(v.limit.liters)+' L':'未設定'],
   ['率基準',v.limit?'±'+v.limit.percent+'%':'未設定']
  ];
  for(const [k,x] of fields){const row=make('div',k==='③ 誤差数量'?'highlight':'');row.append(make('span','',k),make('b','',x));content.append(row);}
  c.append(content);root.append(c);
 }
 const text=hasBad?'×　数値が許容範囲外です':hasNoLimit?'基準未設定の油種があります':all?'数値判定：すべて許容範囲内':'数字の入力・確認が未完了です';
 const out=el('overall');out.textContent=text;out.className='overall '+(hasBad?'bad':all?'good':'pending');
 const count=tanks.reduce((sum,t)=>sum+FIELDS.filter(f=>getEntry(t)[f]!=='').length,0);
 const transfer=el('transferStatus');
 if(transfer)transfer.textContent='入力済み '+count+'／'+(tanks.length*5)+'項目　｜　'+(count?'表の数字を紙へ転記できます。未入力は「—」です。':'入力数字はありません。入力後に自動表示されます。');
 const tb=el('paperBody');tb.replaceChildren();
 const map=new Map(tanks.map(t=>[t.no,t]));
 const max=Math.min(30,Math.max(10,...tanks.map(t=>t.no)));
 for(let no=1;no<=max;no++){
  const tr=make('tr');tr.append(make('td','',String(no)));
  const t=map.get(no);
  if(!t){for(let i=0;i<13;i++)tr.append(make('td','',''));tb.append(tr);continue;}
  const e=getEntry(t),v=calculate(t,e);
  const d=[
   t.capacity,t.oil,
   formatInput(e.A),formatInput(e.B),nfmt(v.one),
   formatInput(e.C),formatInput(e.D),nfmt(v.two),
   nfmt(v.delta),v.rate===null?'—':(v.rate*100).toFixed(2)+'%',
   v.limit?'±'+v.limit.liters+'L / ±'+v.limit.percent+'%':'未設定',
   v.state,formatInput(e.Q)
  ];
  d.forEach((x,i)=>tr.append(make('td',i===11&&v.state==='×'?'bad':'',String(x??''))));
  tb.append(tr);
 }
}
function updateProgress(){
 const flags=['preReceipt','prePos','unloading','postReceipt','posEntered','postPos','paperSaved'];
 const n=flags.filter(x=>Boolean(session().checks[x])).length;
 const data=activeStore().tanks.reduce((sum,t)=>sum+FIELDS.filter(f=>getEntry(t)[f]!=='').length,0);
 const complete=n+ (data===activeStore().tanks.length*5?2:data>0?1:0);
 const root=el('progressLine');root.replaceChildren();
 for(let i=0;i<9;i++)root.append(make('span',i<complete?'done':''));
 el('dateLabel').textContent='入力済み：'+data+' / '+(activeStore().tanks.length*5)+'個';
}
function renderChecks(){
 for(const inp of document.querySelectorAll('[data-check]'))inp.checked=Boolean(session().checks[inp.dataset.check]);
}
function renderAll(){
 renderStoreSelect();renderPos();renderQuickFlow();renderInputFields();renderChecks();renderResults();updateProgress();
}
function clearActiveJob(){
 if(!confirm('この店舗の入力数字・計算結果・進行チェックをすべてクリアします。店舗とタンク設定は残します。よろしいですか？'))return;
 state.sessions[state.active]=blankSession();
 save();renderAll();
 const transfer=el('transferWrap');if(transfer){transfer.scrollLeft=0;transfer.scrollTop=0;}
}
function startNewJob(){
 if(!confirm('この店舗の入力数字とチェックを消去して、新しい荷卸しを始めますか？'))return;
 state.sessions[state.active]=blankSession();save();renderAll();el('step1').scrollIntoView({behavior:'smooth'});
}
function init(){
 load();renderAll();
 el('storeSelect').addEventListener('change',e=>{
  state.active=e.target.value;if(!state.sessions[state.active])state.sessions[state.active]=blankSession();
  save();renderAll();
 });
 el('quickEditCard').addEventListener('click',()=>{
  if(el('quickCardEditor').hidden)openQuickCardEditor();
  else el('quickCardEditor').hidden=true;
 });
 el('quickSaveCard').addEventListener('click',saveQuickCard);
 el('quickCancelCard').addEventListener('click',()=>{el('quickCardEditor').hidden=true;});
 el('quickCardNo').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveQuickCard();}});
 el('quickEditCode').addEventListener('click',()=>{
  if(el('quickCodeEditor').hidden)openQuickCodeEditor();
  else el('quickCodeEditor').hidden=true;
 });
 el('quickSaveCode').addEventListener('click',saveQuickCode);
 el('quickCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveQuickCode();}});
 el('toggleStaffCode').addEventListener('click',openQuickCodeEditor);
 el('newJob').addEventListener('click',startNewJob);
 el('clearDigits').addEventListener('click',clearActiveJob);
 el('goTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
 el('goResult').addEventListener('click',()=>el('step8').scrollIntoView({behavior:'smooth'}));
 el('goPaper').addEventListener('click',()=>el('step9').scrollIntoView({behavior:'smooth'}));
 for(const c of document.querySelectorAll('[data-check]')){
  c.addEventListener('change',()=>{
   session().checks[c.dataset.check]=c.checked;save();updateProgress();
  });
 }
}
if(typeof module!=='undefined'&&module.exports)module.exports={calculate,cleanDigits,sanitizeStore,ito,fuelLimit,FUELS,FIELDS};
if(typeof document!=='undefined')init();
