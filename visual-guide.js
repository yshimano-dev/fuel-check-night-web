/* Illustrated operator reference. Original ENEOS screenshots are not published. */
(function(){
'use strict';
const q=(id)=>document.getElementById(id);
const panel=q('visualDialog'),body=q('visualBody'),title=q('visualTitle');
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chip=(s,active=false)=>'<span class="screen-chip'+(active?' on':'')+'">'+esc(s)+'</span>';
function posScreen(name,highlight,labels){
 return '<div class="mock-screen"><div class="mock-top"><span>画面の再現図</span><span>'+esc(name)+'</span></div><div class="mock-grid">'+
 labels.map(s=>chip(s,s===highlight)).join('')+'</div></div>';
}
function step(n,heading,screen,note){
 return '<div class="visual-step"><strong>'+esc(n+'．'+heading)+'</strong>'+screen+'<p>'+esc(note)+'</p></div>';
}
function gauge(){
 const ito=activeStore()?.id==='ito';
 const print=ito?
 step('1','伊都店：油面計の［印刷］を押す',
  '<div class="mock-gauge"><div class="mock-gauge-bar">油面計｜タンク在庫</div><div class="mock-buttons">'+chip('印刷',true)+chip('表示')+'</div></div>',
  'この店舗では「印刷」ボタンだけで在庫レシートを出せると確認されています。'):
 step('1','油面計の在庫レシートを印字',
  '<div class="mock-gauge"><div class="mock-gauge-bar">油面計｜タンク在庫（機種により異なります）</div><div class="mock-buttons">'+chip('印刷',true)+chip('在庫量')+'</div></div>',
  '店舗によって油面計の機種が違います。操作が分からない場合は店舗の正式な手順を確認してください。POS21のタンク管理レポート印刷とは別です。');
 return '<p class="visual-warning">ここは油面計の「在庫量（L）」レシートを出す工程です。POSから印刷するタンク管理レポートとは別物です。</p>'+
 print+
 step('2','受け入れ完了直後にも、同じ操作で再印字',
 '<div class="mock-gauge"><div class="mock-gauge-bar">在庫レシートの見本（イメージ）</div><div class="mock-receipt">在庫量（L）<div>ハイオク　□□□□□</div><div>レギュラー　□□□□□</div><div>軽油　□□□□□</div><div>灯油　□□□□□</div></div></div>',
 '荷卸し前・後の時刻を確認して取り違えず、管理表に添付してください。')+
 '<p class="visual-warning">今回送ってもらったPOS21の6枚は別工程の資料です。POS21の画面の流れは下の「別機種の参考手順」から見られます。</p>';
}
function energisReport(after=false){
 const label=after?'荷卸し後':'荷卸し前';
 return step('1',label+'のPOS帳票：点検を押す',posScreen('メインメニュー','点検',['通常','点検','情報','売上']),
 'POS側からタンク管理表を印刷する操作です。油面計のレシートとは別です。')+
 step('2','SS営業日報管理 → タンク管理表',posScreen('点検','タンク管理表',['SS営業日報管理','タンク管理表','帳票一覧','当日分']),
 'タンク管理表の当日分へ進みます。')+
 step('3','当日分を選んで印刷',posScreen('タンク管理表','印刷',['当日分','タンク管理表','印刷','戻る']),
 label+'のタンク管理表を用意してください。');
}
function pos21Report(after=false){
 const label=after?'荷卸し後':'荷卸し前';
 return '<p class="visual-warning">ご提供の「POS21：タンク管理レポート出力」の写真（1〜2枚目）をもとに再現しています。POS操作と油面計の在庫レシート印字は異なります。</p>'+
 step('1','メインメニュー → 点検／問合せ',posScreen('メインメニュー','点検／問合せ',['伝票入力','点検／問合せ','精算','登録']),
 '赤枠の「点検／問合せ」を選びます。')+
 step('2','タンク管理',posScreen('点検／問合せ','タンク管理',['タンク管理','営業日報','カード管理','戻る']),
 '表示から「タンク管理」を選びます。')+
 step('3','印刷 → レシート出力',posScreen('タンク管理','印刷',['印刷','レシート出力','前画面へ']),
 label+'のタンク管理レポートを出します。画面の表記やボタン位置は実機を優先してください。');
}
function energisInbound(store,code){
 const name=esc(store.posCardName||'未設定：店舗設定で確認');
 const no=esc(store.posCardNo?store.posCardNo+'番':'未設定');
 return step('1','通常 → 入出荷業務 → 入庫',posScreen('メインメニュー','入出荷業務',['通常','入出荷業務','入庫','戻る']),'入庫の画面を開きます。')+
 '<div class="visual-step"><strong>2．転受カード一覧で選択</strong><div class="mock-screen"><div class="mock-top"><span>入庫</span><span>転受カード一覧</span></div><div class="mock-form-line">カード名称：<b>'+name+'</b></div><div class="mock-form-line emphasis">選択番号：<b>'+no+'</b></div><div class="mock-form-line">次の画面：店受けカード一覧</div></div><p>カードの名称と番号は店舗によって異なります。</p></div>'+
 '<div class="visual-step"><strong>3．担当者コードとタンク・数量の入力</strong><div class="mock-screen"><div class="mock-top"><span>入庫</span><span>店受けカード一覧</span></div><div class="mock-form-line emphasis">担当者コード：<b>'+esc(code||'この端末で登録')+'</b></div><div class="mock-form-line">商品パネル → 油種選択</div><div class="mock-form-line">タンクNo. → 数量入力</div></div><p>入庫数量を伝票と照合し、複数油種があれば繰り返してください。</p></div>';
}
function pos21Inbound(){
 return '<p class="visual-warning">ご提供の「POS21：燃料入庫（仕入）処理」の写真（3〜6枚目）に基づく再現図です。店舗によって実機の画面配置や操作権限は異なります。</p>'+
 step('1','メインメニュー → 伝票入力 → 仕入',posScreen('メインメニュー','伝票入力',['売上','伝票入力','点検／問合せ','仕入']),
 '「伝票入力」の後に「仕入」を選択します。')+
 step('2','仕入先選択 → エネオス',posScreen('仕入先選択','エネオス',['仕入先選択','エネオス','戻る']),
 '仕入先を選択します。')+
 step('3','確定を2回押す',posScreen('仕入入力','確定',['確定','確定','戻る']),
 '元の資料には「確定 ※2回押下」とあります。')+
 step('4','タンクNo.と数量を入力',posScreen('燃料入庫','タンクNo.・数量',['タンクNo.・数量','油種選択','数字入力']),
 '元の資料には「タンクNoと数量のみ入力」とあります。納品伝票と照合します。')+
 step('5','油種を選択し、必要なら繰り返す',posScreen('油種選択','油種選択',['油種選択','確定','戻る']),
 'ほかの油種の入力が必要なら、次の油種を選んで繰り返します。');
}
const types={
 'receipt':{label:'油面計のレシート印字',renderer:()=>gauge()},
 'pos-before':{label:'荷卸し前のPOS帳票印刷',renderer:()=>activeStore().pos==='POS21'?pos21Report():energisReport()},
 'pos-inbound':{label:'POSの燃料入庫（仕入）処理',renderer:()=>activeStore().pos==='POS21'?pos21Inbound():energisInbound(activeStore(),typeof readStaffCode==='function'?readStaffCode(activeStore().id):'')},
 'pos-after':{label:'荷卸し後のPOS帳票印刷',renderer:()=>activeStore().pos==='POS21'?pos21Report(true):energisReport(true)},
 'pos21-report':{label:'別機種POS21：タンク管理レポート出力',renderer:()=>pos21Report()},
 'pos21-inbound':{label:'別機種POS21：燃料入庫（仕入）',renderer:()=>pos21Inbound()}
};
function openVisual(type){
 const config=types[type];if(!config)return;
 title.textContent=config.label+'｜映像で確認';
 body.innerHTML=config.renderer();
 if(!['pos21-report','pos21-inbound'].includes(type)){
  const extra=document.createElement('div');extra.className='visual-alternate';
  extra.innerHTML='<strong>別機種の参考手順（POS21）</strong><p class="caption">提供写真のボタン操作を再現したもので、店舗設定を切り替えずに確認できます。</p><div class="visual-alternate-actions"><button type="button" data-alternate="pos21-report">タンク管理レポートを見る</button><button type="button" data-alternate="pos21-inbound">燃料入庫の操作を見る</button></div>';
  extra.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openVisual(b.dataset.alternate)));
  body.append(extra);
 }
 if(typeof panel.showModal==='function'){if(!panel.open)panel.showModal();}
 else panel.setAttribute('open','');
 panel.scrollTop=0;
}
function closeVisual(){if(panel.open&&typeof panel.close==='function')panel.close();else panel.removeAttribute('open');}
document.querySelectorAll('[data-visual]').forEach(b=>b.addEventListener('click',()=>openVisual(b.dataset.visual)));
q('visualClose')?.addEventListener('click',closeVisual);
panel.addEventListener('click',e=>{if(e.target===panel)closeVisual();});
window.openVisualReference=openVisual;
})();