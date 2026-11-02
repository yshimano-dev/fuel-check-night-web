const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(dir,'stores.js'),'utf8');
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
test('only owner-published stores in official registry, no staff code',()=>{
 const win={};vm.runInNewContext(code,{window:win});
 assert.ok(Array.isArray(win.FUEL_APPROVED_STORES));
 assert.equal(win.FUEL_APPROVED_STORES.length,1);
 assert.equal(win.FUEL_APPROVED_STORES[0].id,'ito');
 assert.deepEqual(Array.from(win.FUEL_APPROVED_STORES[0].tanks,t=>t.no),[1,2,3,10]);
 assert.ok(!/staffCode\s*:/.test(code));
 assert.ok(!/["']99["']/.test(code));
});
test('registration controls, importer, and unsafe client side admin password are absent',()=>{
 for(const id of ['id="addStore"','id="deleteStore"','id="addTank"','id="copyStoreLink"','id="openSettings"'])assert.ok(!html.includes(id),id);
 for(const name of ['function promptStore','function applySharedStore','function encodedStore','function addTank','function deleteStore'])assert.ok(!app.includes(name),name);
 assert.match(html,/stores\.js/);assert.match(app,/approvedStores\(\)/);
 assert.ok(!app.includes('ADMIN_PASSWORD'));
});
test('approved store records are immutable in source and local cards remain editable',()=>{
 assert.match(code,/Object\.freeze/);
 assert.match(app,/state\.cardOverrides/);
 assert.match(html,/id="quickEditCard"/);
 assert.match(html,/id="clearDigits"/);
});

test('central registry holds only manager fields; card and staff settings stay local',()=>{
 const win={};vm.runInNewContext(code,{window:win});
 for(const st of win.FUEL_APPROVED_STORES){
  for(const field of ['pos','posCardName','posCardNo','staffCode','staffMethod'])assert.ok(!(field in st),field);
  assert.ok(st.name&&st.id&&Array.isArray(st.tanks));
  assert.ok(st.tanks.every(t=>Number.isInteger(t.no)&&t.capacity&&t.oil));
 }
 assert.match(app,/STAFF_LOCAL_KEY/);
 assert.match(app,/STAFF_METHOD_KEY/);
 assert.match(app,/state\.cardOverrides/);
});
