/* Source-grounded illustrated quick reference; no ENEOS PDF pages are publicly hosted. */
(function(){
'use strict';
const q=(id)=>document.getElementById(id);
const panel=q('visualDialog'),body=q('visualBody'),title=q('visualTitle');
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function chip(name,spot=false){return '<span class="screen-chip'+(spot?' on':'')+'">'+esc(name)+'</span>';}
function posScreen(name,active,fields){
 const options=fields.map(x=>chip(x,x===active)).join('');
 return '<div class="mock-screen"><div class="mock-top"><span>POS 参考画面</span><span>'+esc(name)+'</span></div><div class="mock-grid">'+options+'</div></div>';
}
function receipt(){
 return '<div class="visual-step"><strong>① 油面計の印刷画面</strong><div class="mock-gauge"><div class="mock-gauge-bar">油面計｜在庫量</div><div class="mock-buttons">'+chip('タンク一覧')+chip('印刷',true)+chip('設定')+'</div><div class="mock-output">'+chip('レシート印字',true)+'</div></div><p>ローリー到着直後に、油面計の［印刷］→［レシート印字］を押して荷卸し前の在庫レシートを取ります。</p></div>'+
 '<div class="visual-step"><strong>② 受け入れが完了した直後にも再印字</strong><div class="mock-gauge"><div class="mock-gauge-bar">油面計｜在庫量</div><div class="mock-buttons">'+chip('印刷',true)+chip('レシート印字',true)+'</div><div class="mock-receipt">在庫量（L）<div>ハイオク　□□□□□</div><div>レギュラー　□□□□□</div><div>軽油　□□□□□</div><div>灯油　□□□□□</div></div></div><p>前後のレシートは取り違えないようにして、タンク管理表と合わせて保管します。</p></div>';
}
function posBefore(pos){
 if(pos==='POS21')return '<div class="visual-step"><strong>POS21 の荷卸し前タンク管理表</strong>'+posScreen('点検・問合せ','タンク管理',['メインメニュー','点検／問合せ','タンク管理','印刷'])+'<p>メインメニューから点検／問合せ→タンク管理→印刷へ。店舗画面に従って荷卸し前の管理表を取り出します。</p></div>';
 return '<div class="visual-step"><strong>① POSメニューの「点検」</strong>'+posScreen('メインメニュー','点検',['通常','点検','情報','売上'])+'</div>'+
 '<div class="visual-step"><strong>② SS営業日報管理 → タンク管理表</strong>'+posScreen('SS営業日報管理','タンク管理表',['SS営業日報管理','タンク管理表','帳票一覧','当日分'])+'</div>'+
 '<div class="visual-step"><strong>③ 「当日分」を選択して印刷</strong>'+posScreen('タンク管理表','印刷',['当日分','タンク管理表','印刷','戻る'])+'<p>荷卸し前の計算在庫Aを確認する帳票です。最初のレシートの実在庫Bと合わせて入力します。</p></div>';
}
function posInbound(store,code){
 const name=esc(store.posCardName||'未設定（カード名称を店舗設定で登録）');
 const number=esc(store.posCardNo?store.posCardNo+'番':'未設定');
 const staff=esc(code||'この端末で登録');
 if(store.pos==='POS21')return '<div class="visual-step"><strong>POS21 の入庫操作イメージ</strong>'+posScreen('伝票入力','仕入',['伝票入力','仕入','仕入先選択','エネオス'])+'<p>伝票入力→仕入→仕入先選択→油種・タンク番号・数量を入力します。スタッフコードは店舗の指示を優先してください。</p></div>';
 return '<div class="visual-step"><strong>① 通常 → 入出荷業務 → 入庫</strong>'+posScreen('メインメニュー','入出荷業務',['通常','入出荷業務','入庫','戻る'])+'</div>'+
 '<div class="visual-step"><strong>② 転受カード一覧で選ぶ</strong><div class="mock-screen"><div class="mock-top"><span>入庫</span><span>転受カード一覧</span></div><div class="mock-form-line">カード名称：<b>'+name+'</b></div><div class="mock-form-line emphasis">選択する一覧番号：<b>'+number+'</b></div><div class="mock-form-line">次の画面：店受けカード一覧</div></div></div>'+
 '<div class="visual-step"><strong>③ 担当者コードを入力して油種・数量へ</strong><div class="mock-screen"><div class="mock-top"><span>入庫</span><span>店受けカード一覧</span></div><div class="mock-form-line emphasis">担当者コード：<b>'+staff+'</b></div><div class="mock-form-line">商品パネル → 油種選択</div><div class="mock-form-line">タンクNo. → 数量入力</div></div><p>複数油種がある場合は商品パネルから繰り返します。油種・タンクNo.・入荷量を伝票と照合してください。</p></div>';
}
const configs={
 'receipt':{label:'レシートの印字',render:()=>receipt()},
 'pos-before':{label:'荷卸し前のPOS操作',render:()=>posBefore(activeStore().pos)},
 'pos-inbound':{label:'POSの入庫処理',render:()=>posInbound(activeStore(),typeof readStaffCode==='function'?readStaffCode(activeStore().id):'')},
 'pos-after':{label:'荷卸し後のPOS帳票印刷',render:()=>posBefore(activeStore().pos).replace(/荷卸し前/g,'荷卸し後')}
};
function openVisual(type){
 const cfg=configs[type];if(!cfg)return;
 title.textContent=cfg.label+'｜映像で確認';
 body.innerHTML=cfg.render();
 if(typeof panel.showModal==='function'){panel.showModal();}
 else panel.setAttribute('open','');
}
function closeVisual(){if(panel.open&&typeof panel.close==='function')panel.close();else panel.removeAttribute('open');}
for(const button of document.querySelectorAll('[data-visual]'))button.addEventListener('click',()=>openVisual(button.dataset.visual));
q('visualClose')?.addEventListener('click',closeVisual);
panel.addEventListener('click',e=>{if(e.target===panel)closeVisual();});
window.openVisualReference=openVisual;
})();