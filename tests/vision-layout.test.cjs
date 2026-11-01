const {test}=require('node:test');
const assert=require('node:assert/strict');
const parser=require('../vision-layout.js');
const before=[[8000,7995],[20000,20023],[7000,7001],[9000,9000]];
const after=[[9970,9980],[35900,35900],[10900,10903],[9000,8999]];
const quantity=[2000,16000,4000,0];
function w(n,x,y){return {text:n.toLocaleString('en-US'),x:Math.round(x*1000)-8,y:Math.round(y*1000)-5,width:16,height:10}}
function page(rows,qty){
 const words=[];
 for(let i=0;i<4;i++){words.push(w(rows[i][0],.46,.15+i*.014));words.push(w(rows[i][0],.405,.545+i*.010));words.push(w(rows[i][1],.86,.713+i*.016));if(qty)words.push(w(qty[i],.35,.15+i*.014));}
 words.push(w(525,.86,.777));return {pageWidth:1000,pageHeight:1000,words};
}
test('four oils remain correctly aligned across all five fields',()=>{
 const out=parser.parse(page(before),page(after,quantity));
 assert.equal(out.completeColumns,5);
 for(let i=0;i<4;i++){let oil='HRDK'[i];assert.equal(Number(out.drafts[oil].A),before[i][0]);assert.equal(Number(out.drafts[oil].B),before[i][1]);assert.equal(Number(out.drafts[oil].C),after[i][0]);assert.equal(Number(out.drafts[oil].D),after[i][1]);assert.equal(Number(out.drafts[oil].Q),quantity[i]);}
});
test('inconsistent top/bottom tank manager inventory is not assigned',()=>{
 const changed=page(after,quantity);
 changed.words=changed.words.filter(v=>!(v.text==='9,970'&&v.x===397));
 changed.words.push(w(9990,.405,.545));
 const out=parser.parse(page(before),changed);
 assert.equal(out.drafts.H.C,undefined);
 assert.ok(out.warnings.some(x=>x.startsWith('C：')));
});
test('missing one receipt row cannot shift remaining fuels',()=>{
 const missing=page(before);
 missing.words=missing.words.filter(v=>!(v.text==='20,023'&&v.x>800));
 const out=parser.parse(missing,page(after,quantity));
 for(const oil of 'HRDK')assert.equal(out.drafts[oil].B,undefined);
});
test('extra duplicate on the same line is rejected',()=>{
 const extra=page(before);
 extra.words.push(w(9099,.865,.713+.032));
 const out=parser.parse(extra,page(after,quantity));
 for(const oil of 'HRDK')assert.equal(out.drafts[oil].B,undefined);
});
test('empty OCR result remains blank and warns',()=>{
 const empty={pageWidth:1000,pageHeight:1000,words:[]};
 const out=parser.parse(empty,empty);
 assert.equal(out.completeColumns,0);
 assert.equal(out.drafts.H.A,undefined);
 assert.ok(out.warnings.length>0);
});
