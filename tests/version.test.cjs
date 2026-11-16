const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.join(__dirname,'..');
const original=fs.readFileSync(path.join(root,'index.html'),'utf8');
const match=original.match(/id="releaseVersion" data-version="(\d+)\.(\d+)\.(\d+)" data-revision="(\d+)">([^<]+)</);
if(!match)throw Error('version metadata missing');
const [major,minor,patch,revision]=match.slice(1,5).map(Number);
const ver=[major,minor,patch].join('.');
test('small release label, history and all assets use a matching version',()=>{
 assert.match(match[5],new RegExp('改訂第'+revision+'版 · Ver\\.'+major+'\\.'+minor+'\\.'+patch));
 assert.match(original,/id="releaseHistory"/);
 for(const asset of ['style.css','stores.js','app.js','visual-guide.js'])
  assert.ok(original.includes(asset+'?v=v'+[major,minor,patch].join('_')),asset);
});
test('automatic patch and minor updates preserve history and cache invalidation',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fuel-version-test-'));
 try{
  fs.mkdirSync(path.join(tmp,'scripts'));
  fs.writeFileSync(path.join(tmp,'index.html'),original,'utf8');
  fs.copyFileSync(path.join(root,'scripts','bump-version.cjs'),path.join(tmp,'scripts','bump-version.cjs'));
  const script=path.join(tmp,'scripts','bump-version.cjs');
  cp.execFileSync(process.execPath,[script,'patch','文言の微修正'],{cwd:tmp});
  let html=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
  const nextPatch=[major,minor,patch+1].join('.');
  assert.ok(html.includes('data-version="'+nextPatch+'" data-revision="'+revision+'"'));
  assert.ok(html.includes('app.js?v=v'+[major,minor,patch+1].join('_')));
  cp.execFileSync(process.execPath,[script,'minor','操作画面を追加'],{cwd:tmp});
  html=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
  const nextMinor=[major,minor+1,0].join('.');
  assert.ok(html.includes('data-version="'+nextMinor+'" data-revision="'+(revision+1)+'"'));
  assert.ok(html.includes('style.css?v=v'+[major,minor+1,0].join('_')));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
