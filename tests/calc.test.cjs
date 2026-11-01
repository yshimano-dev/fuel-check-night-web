const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {calc,cleanDigits,defaults,FIXED_TANKS,STAGES}=require('../app.js');

const T=(oil,A,B,C,D,Q)=>({oil,A:String(A),B:String(B),C:String(C),D:String(D),Q:String(Q)});

test('tank labels and ordering match original document',()=>{
 assert.deepEqual(FIXED_TANKS.map(t=>[t.no,t.capacity,t.oil]),[
  [1,'14KL','H'],[2,'48KL','R'],[3,'14KL','D'],[10,'20KL','K']]);
 assert.deepEqual(STAGES.map(s=>s.field),['A','B','C','D','Q']);
 const d=defaults();assert.equal(d.length,4);assert.ok(d.every(t=>STAGES.every(s=>t[s.field]==='')));
});

test('2026-10-24 actual report H,R,D,K',()=>{
 let h=calc(T('H',7518,7514,11463,11461,4000));
 assert.equal(h.one,-4);assert.equal(h.two,-2);assert.equal(h.three,2);assert.equal(h.rate,.0005);assert.equal(h.state,'○');
 let r=calc(T('R',23678,23683,39395,39355,16000));
 assert.equal(r.one,5);assert.equal(r.two,-40);assert.equal(r.three,-45);assert.equal(r.state,'○');
 let d=calc(T('D',7446,7445,11403,11415,4000));
 assert.equal(d.one,-1);assert.equal(d.two,12);assert.equal(d.three,13);assert.equal(d.state,'○');
 let k=calc(T('K',9575,9575,9575,9575,0));
 assert.equal(k.state,'—');assert.equal(k.rate,null);
});
test('2026-10-28 actual R with 24,000L arrival',()=>{
 let r=calc(T('R',17412,17446,41139,41118,24000));
 assert.equal(r.three,-55);
 assert.equal(Number((r.rate*100).toFixed(2)),-.23);
 assert.equal(r.state,'○');
});
test('2026-10-30 A and C taken from original POS report (not conflicting checklist)',()=>{
 let r=calc(T('H',7885,7830,9720,9714,2000));
 assert.equal(r.three,49);assert.equal((r.rate*100).toFixed(2),'2.45');assert.equal(r.state,'○');
});
test('H/R/D quantity limit in both directions is inclusive',()=>{
 for(const oil of ['H','R','D']){
  assert.equal(calc(T(oil,1000,1000,1000,1400,20000)).state,'×');
  assert.equal(calc(T(oil,1000,1000,1000,600,20000)).state,'×');
  assert.equal(calc(T(oil,1000,1000,1000,1399,20000)).state,'○');
 }
});
test('2.5 percent limit is inclusive in both directions',()=>{
 for(const oil of ['H','R','D','K']){
  assert.equal(calc(T(oil,1000,1000,1000,1050,2000)).state,'×');
  assert.equal(calc(T(oil,1000,1000,1000,950,2000)).state,'×');
  assert.equal(calc(T(oil,1000,1000,1000,1049,2000)).state,'○');
 }
});
test('K 100 L limit inclusive',()=>{
 assert.equal(calc(T('K',1000,1000,1000,1100,10000)).state,'×');
 assert.equal(calc(T('K',1000,1000,1000,900,10000)).state,'×');
 assert.equal(calc(T('K',1000,1000,1000,1099,10000)).state,'○');
});
test('Q zero cannot divide by zero but quantity exception triggers X',()=>{
 let r=calc(T('K',1000,1000,1000,1100,0));
 assert.equal(r.rate,null);assert.equal(r.state,'×');
 let other=calc(T('H',1000,1000,1000,1001,0));
 assert.equal(other.rate,null);assert.equal(other.state,'—');
});
test('missing values do not produce a false OK',()=>{
 assert.equal(calc({oil:'H',A:'',B:'0',C:'',D:'',Q:'4000'}).state,'要入力');
 assert.equal(calc(T('H',0,0,0,0,2000)).state,'○');
});
test('numeric input handles grouped printed integers and Japanese comma',()=>{
 assert.equal(cleanDigits('7,830'),'7830');assert.equal(cleanDigits('7,830.0'),'7830');
 assert.equal(cleanDigits('２４,４８５'),'24485');
 assert.equal(cleanDigits('0'),'0');
});
test('HTML has no photo/camera buttons and numeric-keyboard support is in app',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
 assert.ok(!html.includes('type="file"'));
 assert.ok(!html.includes('tesseract'));
 assert.ok(html.includes('./app.js'));
 const code=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
 assert.ok(code.includes("inp.inputMode='numeric'"));
 assert.ok(code.includes('inp.enterKeyHint'));
});
