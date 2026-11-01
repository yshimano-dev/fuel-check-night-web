const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const st=html.indexOf('function calc(t){'),ed=html.indexOf('\nfunction init()',st);
assert.ok(st>0&&ed>st);
const fns=html.slice(html.indexOf('function normalize(value)'),st);
const calc=vm.runInNewContext(fns+html.slice(st,ed)+'\ncalc');
const T=(oil,A,B,C,D,Q)=>({oil,A:String(A),B:String(B),C:String(C),D:String(D),Q:String(Q)});
test('real 2026-10-24 H R D example matches written checklist',()=>{
 let h=calc(T('H',7518,7514,11463,11461,4000));assert.equal(h.three,2);assert.equal(h.rate,.0005);assert.equal(h.state,'○');
 let r=calc(T('R',23678,23683,39395,39355,16000));assert.equal(r.three,-45);assert.equal(r.state,'○');
 let d=calc(T('D',7446,7445,11403,11415,4000));assert.equal(d.three,13);assert.equal(d.state,'○');
});
test('H/R/D exactly 400L in either direction is ×',()=>{
 assert.equal(calc(T('R',1000,1000,1000,1400,20000)).state,'×');
 assert.equal(calc(T('D',1000,1000,1000,600,20000)).state,'×');
});
test('H/R/D 2.5% exactly triggers × before 400L',()=>{
 assert.equal(calc(T('H',1000,1000,1000,1050,2000)).state,'×');
 assert.equal(calc(T('R',1000,1000,1000,950,2000)).state,'×');
});
test('K (tank 10) 100 L and 2.5% thresholds are both active',()=>{
 assert.equal(calc(T('K',1000,1000,1000,1100,10000)).state,'×');
 assert.equal(calc(T('K',1200,1200,1200,1100,10000)).state,'×');
 assert.equal(calc(T('K',1000,1000,1000,1050,2000)).state,'×');
 assert.equal(calc(T('K',1000,1000,1000,1049,2000)).state,'○');
});
test('no intake does not divide by zero or fake a percentage',()=>{
 let x=calc(T('K',9575,9575,9575,9575,0));assert.equal(x.rate,null);assert.equal(x.state,'—');
});
test('zero intake: liters threshold still gives ×; percent is undefined',()=>{
 const k=calc(T('K',1000,1000,1000,1100,0));
 assert.equal(k.rate,null);assert.equal(k.state,'×');
 const h=calc(T('H',1000,1000,1000,1400,0));
 assert.equal(h.rate,null);assert.equal(h.state,'×');
});
test('missing readings are not approved',()=>{
 let x=calc({oil:'H',A:'',B:'',C:'',D:'',Q:'4000'});assert.equal(x.state,'要入力');
});
test('tank 1 H, 2 R, 3 D, 10 K fixed and nonconflicting v2 storage key',()=>{
 assert.ok(html.includes("0:{capacity:'14KL',oil:'H'}"));
 assert.ok(html.includes("1:{capacity:'48KL',oil:'R'}"));
 assert.ok(html.includes("2:{capacity:'14KL',oil:'D'}"));
 assert.ok(html.includes("9:{capacity:'20KL',oil:'K'}"));
 assert.match(html,/fuel-check-paper-v2-correct-fuels/);
});
