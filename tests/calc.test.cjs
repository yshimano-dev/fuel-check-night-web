const {test}=require('node:test');
const assert=require('node:assert/strict');
const {calculate,cleanDigits,sanitizeStore,ito,fuelLimit,FIELDS}=require('../app.js');
const T=(oil,A,B,C,D,Q,limits={})=>[{oil,...limits},{A:String(A),B:String(B),C:String(C),D:String(D),Q:String(Q)}];
function r(...args){const [a,b]=T(...args);return calculate(a,b);}
test('Ito default and five numeric fields',()=>{
 const x=ito();assert.deepEqual(x.tanks.map(t=>[t.no,t.oil,t.capacity]),[[1,'H','14KL'],[2,'R','48KL'],[3,'D','14KL'],[10,'K','20KL']]);
 assert.deepEqual(FIELDS,['A','B','C','D','Q']);
});
test('2026-10-24 paper results reproduce',()=>{
 let x=r('H',7518,7514,11463,11461,4000);assert.equal(x.one,-4);assert.equal(x.two,-2);assert.equal(x.delta,2);assert.equal(x.state,'○');
 x=r('R',23678,23683,39395,39355,16000);assert.equal(x.delta,-45);assert.equal(x.state,'○');
 x=r('D',7446,7445,11403,11415,4000);assert.equal(x.delta,13);assert.equal(x.state,'○');
 x=r('K',9575,9575,9575,9575,0);assert.equal(x.rate,null);assert.equal(x.state,'入荷なし');
});
test('2026-10-30 POS print discrepancy is not hidden',()=>{
 const x=r('H',7885,7830,9720,9714,2000);
 assert.equal(x.delta,49);assert.equal((x.rate*100).toFixed(2),'2.45');assert.equal(x.state,'○');
});
test('H R D ±400 and ±2.5% are inclusive',()=>{
 for(const fuel of ['H','R','D']){
  assert.equal(r(fuel,1000,1000,1000,1400,20000).state,'×');
  assert.equal(r(fuel,1000,1000,1000,600,20000).state,'×');
  assert.equal(r(fuel,1000,1000,1000,1399,20000).state,'○');
  assert.equal(r(fuel,1000,1000,1000,1050,2000).state,'×');
  assert.equal(r(fuel,1000,1000,1000,950,2000).state,'×');
 }
});
test('K uses ±100 and ±2.5% independent of tank number',()=>{
 assert.equal(r('K',1000,1000,1000,1100,10000).state,'×');
 assert.equal(r('K',1000,1000,1000,900,10000).state,'×');
 assert.equal(r('K',1000,1000,1000,1099,10000).state,'○');
 assert.equal(r('K',1000,1000,1000,1050,2000).state,'×');
 assert.equal(fuelLimit('K').liters,100);
});
test('zero delivery does not divide, but large quantity difference triggers X',()=>{
 let x=r('K',1000,1000,1000,1100,0);assert.equal(x.state,'×');assert.equal(x.rate,null);
 x=r('H',1000,1000,1000,1000,0);assert.equal(x.state,'入荷なし');
});
test('unknown fuel without owner-confirmed thresholds never returns OK',()=>{
 let x=r('OTHER',1000,1000,1000,1000,2000);assert.equal(x.state,'基準未設定');
 x=r('OTHER',1000,1000,1000,1080,2000,{limitL:75,limitPct:4});
 assert.equal(x.state,'×');
});
test('missing values cannot give OK',()=>{
 const x=calculate({oil:'H'},{A:'',B:'0',C:'1000',D:'1200',Q:'4000'});assert.equal(x.state,'未入力');
});
test('two tanks may have same oil with unique numbers',()=>{
 const x=sanitizeStore({id:'a',name:'別店舗',pos:'POS21',tanks:[{no:1,oil:'H',capacity:'14KL'},{no:2,oil:'H',capacity:'20KL'},{no:10,oil:'K',capacity:'14KL'}]});
 assert.ok(x);assert.deepEqual(x.tanks.map(t=>t.oil),['H','H','K']);
 assert.equal(x.pos,'POS21');
});
test('duplicate tank numbers rejected; custom fuel must configure thresholds',()=>{
 assert.equal(sanitizeStore({name:'x',tanks:[{no:1,oil:'H'},{no:1,oil:'R'}]}),null);
 const x=sanitizeStore({name:'x',tanks:[{no:1,oil:'OTHER',limitL:300,limitPct:2} ]});assert.equal(x.tanks[0].limitL,300);
});
test('numeric keypad pasted data',()=>{
 assert.equal(cleanDigits('７,８３０.０'),'7830');assert.equal(cleanDigits('24,479'),'24479');assert.equal(cleanDigits('0'),'0');
 assert.equal(cleanDigits('123.5'),null);
});
