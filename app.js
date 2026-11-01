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
let state={stores:[ito()],active:'ito',sessions:{ito:blankSession()}};
function load(){
 try{
  const s=JSON.parse(localStorage.getItem(STORAGE)||'null');
  if(s&&Array.isArray(s.stores)&&s.stores.length){
   const stores=s.stores.map(sanitizeStore).filter(Boolean);
   if(stores.length){state={stores,active:stores.some(x=>x.id===s.active)?s.active:stores[0].id,sessions:(s.sessions&&typeof s.sessions==='object')?s.sessions:{}};}
  } else {
   // Start a new workflow with blank quantities. Never carry unverified data
   // from an older app version into the next unloading operation.
  }
 }catch(e){state={stores:[ito()],active:'ito',sessions:{ito:blankSession()}};}
 if(!state.sessions[state.active])state.sessions[state.active]=blankSession();
 applySharedStore();
}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}}
function activeStore(){return state.stores.find(x=>x.id===state.active)||state.stores[0];}
function session(){if(!state.sessions[state.active])state.sessions[state.active]=blankSession();return state.sessions[state.active];}
function getEntry(t){const key=String(t.no);const s=session();if(!s.values[key])s.values[key]={A:'',B:'',C:'',D:'',Q:''};return s.values[key];}
function encodedStore(st){
 // Only non-secret display information is shared. Staff codes never enter URLs.
 const text=JSON.stringify({name:st.name,pos:st.pos,posCardName:st.posCardName,posCardNo:st.posCardNo,tanks:st.tanks});
 return btoa(unescape(encodeURIComponent(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function applySharedStore(){
 const hash=location.hash.match(/^#store=([A-Za-z0-9_-]+)$/);
 if(!hash)return;
 try{
  const enc=hash[1].replace(/-/g,'+').replace(/_/g,'/');
  const payload=JSON.parse(decodeURIComponent(escape(atob(enc))));
  const st=sanitizeStore({...payload,id:'shared-'+Date.now()});
  if(!st||!confirm('LINEで共有された「'+st.name+'」の店舗設定をこの端末に追加しますか？'))return;
  state.stores.push(st);state.active=st.id;state.sessions[st.id]=blankSession();
  save();history.replaceState(null,'',location.pathname+location.search);
 }catch(e){/* Invalid link is ignored; no data is changed. */}
}
function el(id){return document.getElementById(id);}
function make(tag,cls,text){
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;return node;
}
function promptStore(){
 const name=prompt('新しい店舗名を入力してください');
 if(!name||!name.trim())return;
 const st=sanitizeStore({id:'s'+Date.now(),name,pos:'ENERIS',tanks:[{no:1,capacity:'',oil:'R'}]});
 if(!st)return;
 state.stores.push(st);state.active=st.id;state.sessions[st.id]=blankSession();save();renderAll();
 el('settings').hidden=false;el('settings').open=true;
 el('settings').scrollIntoView({behavior:'smooth'});
}
function renderStoreSelect(){
 const sel=el('storeSelect');sel.replaceChildren();
 for(const s of state.stores){const option=make('option','',s.name);option.value=s.id;sel.append(option);}
 sel.value=state.active;
 el('storeName').value=activeStore().name;
 el('posType').value=activeStore().pos;
 el('posCardName').value=activeStore().posCardName||'';
 el('posCardNo').value=activeStore().posCardNo||'';
}
function updateStore(mut){
 mut(activeStore());
 const updated=sanitizeStore(activeStore());
 if(!updated)return;
 const index=state.stores.findIndex(s=>s.id===state.active);state.stores[index]=updated;
 // Hide stale data for removed tank numbers, but preserve data of active tanks.
 const valid=new Set(updated.tanks.map(t=>String(t.no)));
 for(const key of Object.keys(session().values))if(!valid.has(key))delete session().values[key];
 save();renderAll();
}
function renderTankSettings(){
 const root=el('tankSettings');root.replaceChildren();
 const h=make('div','field-labels');['No.','容量','油種','基準L','基準%','削除'].forEach(s=>h.append(make('span','',s)));root.append(h);
 for(const tank of activeStore().tanks){
  const r=make('div','tank-setting');
  const no=make('b','',String(tank.no));r.append(no);
  const cap=make('input');cap.type='text';cap.value=tank.capacity;cap.placeholder='例14KL';cap.maxLength=12;
  cap.addEventListener('change',()=>updateStore(st=>{const t=st.tanks.find(x=>x.no===tank.no);if(t)t.capacity=cap.value.trim();}));r.append(cap);
  const oil=make('select');for(const [v,lab] of FUELS){const opt=make('option','',lab);opt.value=v;oil.append(opt)}oil.value=tank.oil;
  oil.addEventListener('change',()=>updateStore(st=>{const t=st.tanks.find(x=>x.no===tank.no);if(t){t.oil=oil.value;if(t.oil!=='OTHER'){delete t.limitL;delete t.limitPct;}}}));r.append(oil);
  for(const type of ['limitL','limitPct']){
   const inp=make('input');inp.inputMode='decimal';inp.type='number';inp.min='0';inp.step=type==='limitPct'?'0.1':'1';
   const known=fuelLimit(tank.oil);inp.value=known?known[type==='limitL'?'liters':'percent']:(tank[type]??'');
   inp.disabled=!!known;inp.title=known?'油種に応じた固定基準です':'店舗の正式な許容基準を入力';
   inp.addEventListener('change',()=>updateStore(st=>{const t=st.tanks.find(x=>x.no===tank.no);if(t)t[type]=Number(inp.value)>0?Number(inp.value):null;}));r.append(inp);
  }
  const del=make('button','delete','×');del.type='button';del.title='このタンクを削除';del.disabled=activeStore().tanks.length<=1;
  del.addEventListener('click',()=>{if(!confirm('タンクNo.'+tank.no+'を削除しますか？'))return;updateStore(st=>{st.tanks=st.tanks.filter(t=>t.no!==tank.no);});});r.append(del);root.append(r);
 }
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
  path.append(chip);
 });
 root.append(path);
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
   {label:'カード名称 '+name,href:'#step6'},
   {label:no,href:'#step6',important:true},
   {label:'店受けカード一覧',href:'#step6'},
   {label:'担当者コード '+(code||'未登録'),href:'#quickCodeEditor',important:true},
   {label:'油種・数量 → 後POS印刷',href:'#step6'},
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
 'メインメニュー','伝票入力','仕入','仕入先選択（店舗の設定を確認）',
 'エネオス','確定（2回）','油種選択','タンクNo.・数量'
 ];
 el('prePosTitle').textContent=pos==='ENERIS'?'ENERIS-POS：荷卸し前のタンク管理表':'POS21：荷卸し前のタンク管理表';
 renderPath('prePosPath',pre);
 renderPath('postPosPath',post);
 renderPath('postReportPath',pre);
 const hint=el('posSelectionHint');
 hint.textContent=pos==='ENERIS'?
 ('この店舗で選ぶカード：'+chosenName+'／選択番号：'+chosenNo+
  '。担当者コードは下欄に入力（共有リンクには含まれません）。'):
 'POS21用の操作案内です。カード選択や担当者コードは店舗の正式設定を確認してください。';
 hint.classList.toggle('needs-config',pos==='ENERIS'&&(!store.posCardName||!store.posCardNo));
 el('posNote').textContent=pos==='ENERIS'?
 'ENEOSの2026年10月15日版マニュアル16〜21ページの画面順を参考にしています。入庫カードの名称・番号は店舗ごとに異なるため、事前に店舗設定で登録してください。複数油種は「商品パネル」から繰り返します。':
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
 renderStoreSelect();renderTankSettings();renderPos();renderQuickFlow();renderInputFields();renderChecks();renderResults();updateProgress();
}
function startNewJob(){
 if(!confirm('この店舗の入力数字とチェックを消去して、新しい荷卸しを始めますか？'))return;
 state.sessions[state.active]=blankSession();save();renderAll();el('step1').scrollIntoView({behavior:'smooth'});
}
function addTank(){
 const st=activeStore();if(st.tanks.length>=20){alert('タンクは最大20件までです');return;}
 const existing=new Set(st.tanks.map(x=>x.no));
 const proposal=Array.from({length:30},(_,i)=>i+1).find(n=>!existing.has(n));
 const given=prompt('追加するタンク番号（1〜30）',String(proposal||1));
 if(given===null)return;
 const no=Number(given);
 if(!Number.isInteger(no)||no<1||no>30||existing.has(no)){alert('タンク番号は1〜30の未使用番号を指定してください');return;}
 updateStore(st=>st.tanks.push({no,capacity:'',oil:'R'}));
}
function deleteStore(){
 if(state.stores.length===1){alert('最後の1店舗は削除できません');return;}
 if(!confirm('「'+activeStore().name+'」と、その店舗の保存した数字を削除しますか？'))return;
 const id=state.active;writeStaffCode(id,'');state.stores=state.stores.filter(x=>x.id!==id);delete state.sessions[id];
 state.active=state.stores[0].id;save();renderAll();
}
async function copyStoreLink(){
 const u=location.origin+location.pathname+'#store='+encodedStore(activeStore());
 try{
  await navigator.clipboard.writeText(u);
  el('settingsMessage').textContent='店舗設定リンクをコピーしました。LINEに貼り付けて共有できます（数値は含みません）。';
 }catch(e){prompt('このリンクをコピーしてLINEで送ってください',u);}
}
function init(){
 load();renderAll();
 el('storeSelect').addEventListener('change',e=>{
  state.active=e.target.value;if(!state.sessions[state.active])state.sessions[state.active]=blankSession();
  save();renderAll();
 });
 el('openSettings').addEventListener('click',()=>{
  const root=el('settings');root.hidden=!root.hidden;if(!root.hidden){root.open=true;root.scrollIntoView({behavior:'smooth',block:'start'});}
 });
 el('storeName').addEventListener('change',e=>updateStore(st=>{st.name=e.target.value.trim()||st.name;}));
 el('posType').addEventListener('change',e=>updateStore(st=>{st.pos=e.target.value;}));
 el('posCardName').addEventListener('change',e=>updateStore(st=>{st.posCardName=e.target.value.trim();}));
 el('posCardNo').addEventListener('change',e=>{
  const next=e.target.value.trim();
  if(next&&!/^\d{1,5}$/.test(next)){alert('カード番号は5桁以内の数字で入力してください。');renderStoreSelect();return;}
  updateStore(st=>{st.posCardNo=next;});
 });
 el('quickEditCode').addEventListener('click',()=>{
  if(el('quickCodeEditor').hidden)openQuickCodeEditor();
  else el('quickCodeEditor').hidden=true;
 });
 el('quickSaveCode').addEventListener('click',saveQuickCode);
 el('quickCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveQuickCode();}});
 el('toggleStaffCode').addEventListener('click',openQuickCodeEditor);
 el('addStore').addEventListener('click',promptStore);
 el('addTank').addEventListener('click',addTank);
 el('deleteStore').addEventListener('click',deleteStore);
 el('copyStoreLink').addEventListener('click',copyStoreLink);
 el('newJob').addEventListener('click',startNewJob);
 el('goTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
 el('goResult').addEventListener('click',()=>el('step8').scrollIntoView({behavior:'smooth'}));
 for(const c of document.querySelectorAll('[data-check]')){
  c.addEventListener('change',()=>{
   session().checks[c.dataset.check]=c.checked;save();updateProgress();
  });
 }
}
if(typeof module!=='undefined'&&module.exports)module.exports={calculate,cleanDigits,sanitizeStore,ito,fuelLimit,FUELS,FIELDS};
if(typeof document!=='undefined')init();
