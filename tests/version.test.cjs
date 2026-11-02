const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.join(__dirname,'..');
const original=fs.readFileSync(path.join(root,'index.html'),'utf8');
test('current trial release shows subtle fifth revision and matching assets',()=>{
 const marker=original.match(/id="releaseVersion" data-version="([^"]+)" data-revision="([^"]+)">([^<]+)</);
 assert.ok(marker);
 assert.equal(marker[1],'0.5.0');
 assert.equal(marker[2],'5');
 assert.match(marker[3],/改訂第5版 · Ver\.0\.5\.0/);
 assert.match(original,/id="releaseHistory"/);
 for(const asset of ['style.css','stores.js','app.js','visual-guide.js']){
  assert.ok(original.includes(asset+'?v=v0_5_0'),asset);
 }
});
test('release command bumps patch, next minor, history and cache-busting parameters',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fuel-version-test-'));
 try{
  fs.mkdirSync(path.join(tmp,'scripts'));
  fs.writeFileSync(path.join(tmp,'index.html'),original,'utf8');
  fs.copyFileSync(path.join(root,'scripts','bump-version.cjs'),path.join(tmp,'scripts','bump-version.cjs'));
  cp.execFileSync(process.execPath,[path.join(tmp,'scripts','bump-version.cjs'),'patch','文言の微修正'],{cwd:tmp});
  let html=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
  assert.match(html,/data-version="0\.5\.1" data-revision="5"/);
  assert.match(html,/Ver\.0\.5\.1（/);
  assert.match(html,/app\.js\?v=v0_5_1/);
  cp.execFileSync(process.execPath,[path.join(tmp,'scripts','bump-version.cjs'),'minor','操作画面を追加'],{cwd:tmp});
  html=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
  assert.match(html,/data-version="0\.6\.0" data-revision="6"/);
  assert.match(html,/改訂第6版 · Ver\.0\.6\.0/);
  assert.match(html,/style\.css\?v=v0_6_0/);
 } finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
