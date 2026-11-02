/* Update the public version and release log in a single command.
   Usage: node scripts/bump-version.cjs patch "変更内容"
          node scripts/bump-version.cjs minor "主な機能追加"
          node scripts/bump-version.cjs major "正式リリース" */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const file=path.resolve(__dirname,'..','index.html');
const [kind,note]=process.argv.slice(2);
if(!['patch','minor','major'].includes(kind)||!note||note.length>180){
 console.error('Usage: node scripts/bump-version.cjs patch|minor|major "更新内容（180字以内）"');
 process.exit(1);
}
const raw=fs.readFileSync(file,'utf8');
const pattern=/<span id="releaseVersion" data-version="(\d+)\.(\d+)\.(\d+)" data-revision="(\d+)">[^<]+<\/span>/;
const match=raw.match(pattern);
if(!match)throw Error('公開バージョンの記述が見つかりません');
let [major,minor,patch,revision]=match.slice(1).map(Number);
if(kind==='major'){major++;minor=0;patch=0;revision++;}
else if(kind==='minor'){minor++;patch=0;revision++;}
else patch++;
const v=[major,minor,patch].join('.');
const safeNote=note.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/-/g,'/');
const label='改訂第'+revision+'版 · Ver.'+v;
let html=raw.replace(pattern,'<span id="releaseVersion" data-version="'+v+'" data-revision="'+revision+'">'+label+'</span>');
const history='<ol id="releaseHistory">';
if(!html.includes(history))throw Error('改訂履歴が見つかりません');
const entry='\n    <li>Ver.'+v+'（'+now+'）'+safeNote+'</li>';
html=html.replace(history,history+entry);
const cacheTag='v'+v.replace(/\./g,'_');
html=html.replace(/(\b(?:style\.css|stores\.js|app\.js|visual-guide\.js)\?v=)[^"']+/g,(_full,prefix)=>prefix+cacheTag);
fs.writeFileSync(file,html,'utf8');
console.log(label+' / '+now+' / '+note);
