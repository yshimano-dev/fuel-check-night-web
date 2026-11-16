const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
test('POS receipt warning and original official 3-page bundle are separately documented',()=>{
 assert.match(html,/POS入庫処理で出たレシートは捨てない/);
 assert.match(html,/ローリーの納品伝票/);
 for(const name of ['荷卸し検証チェック表','荷卸し前のタンク管理表','荷卸し後のタンク管理表','油面計の在庫レシート'])
  assert.ok(html.includes(name),name);
 assert.match(html,/荷卸し検証：3枚1セット/);
 assert.match(html,/POS入庫処理：別の2点セット/);
 assert.match(html,/朝の担当者への引継ぎ/);
});
test('both preservation checks and morning handover are persisted and cleared on next job',()=>{
 for(const field of ['posReceiptSaved','morningHandoff','paperSaved']){
  assert.ok(app.includes(field),'missing saved field '+field);
  assert.ok(html.includes('data-check="'+field+'"'),'missing control '+field);
 }
 assert.match(app,/session\(\)\.checks\[c\.dataset\.check\]=c\.checked;save\(\);renderChecks\(\)/);
 assert.match(app,/state\.sessions\[state\.active\]=blankSession\(\)/);
});
