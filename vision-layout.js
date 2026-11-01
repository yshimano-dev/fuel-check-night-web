/* Conservative layout parser: candidate-only, never auto-approves OCR output. */
(function(root,factory){const p=factory();if(typeof module==='object'&&module.exports)module.exports=p;if(root)root.FuelLayoutParser=p;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const oils=['H','R','D','K'], zones={
main:{x:[.405,.545],y:[.095,.235],kind:'volume'},
physical:{x:[.348,.505],y:[.47,.665],kind:'volume'},
receipt:{x:[.768,.953],y:[.657,.877],kind:'receipt'},
quantity:{x:[.295,.425],y:[.095,.235],kind:'quantity'}};
function tokens(p){if(!p||!Array.isArray(p.words)||!(p.pageWidth>0)||!(p.pageHeight>0))return [];
return p.words.map(w=>({raw:String(w.text||'').replace(/[０-９]/g,ch=>String(ch.charCodeAt(0)-65296)).replace(/，/g,',').replace(/．/g,'.'),
x:(w.x+(w.width||0)/2)/p.pageWidth,y:(w.y+(w.height||0)/2)/p.pageHeight,h:(w.height||0)/p.pageHeight})).filter(t=>Number.isFinite(t.x)&&Number.isFinite(t.y));}
function numeric(t,canZero){const s=t.raw.trim();if(!/^(?:\d{1,3}(?:,\d{3})+|\d{1,6})(?:\.0+)?$/.test(s))return null;
const n=Number(s.replace(/,/g,''));if(!Number.isInteger(n)||n<0||n>=100000||(!canZero&&n<1000))return null;return {...t,n};}
function extract(page,name){
 const z=zones[name];const input=tokens(page).filter(t=>t.x>=z.x[0]&&t.x<=z.x[1]&&t.y>=z.y[0]&&t.y<=z.y[1]).map(t=>numeric(t,z.kind!=='volume')).filter(Boolean).sort((a,b)=>a.y-b.y||a.x-b.x);
 const rows=[];
 for(const item of input){const last=rows[rows.length-1];if(last&&Math.abs(last.y-item.y)<Math.max(.0035,Math.min(.0065,item.h*.65)))last.choices.push(item);else rows.push({y:item.y,choices:[item]});}
 const count=name==='receipt'?5:4;
 if(rows.length!==count)return {values:null,status:'missing_or_extra_rows',count:rows.length};
 if(rows.some(r=>r.choices.length!==1))return {values:null,status:'multiple_numbers_per_row',count:rows.length};
 const ys=rows.map(r=>r.y),gaps=ys.slice(1).map((v,i)=>v-ys[i]);
 if(Math.min(...gaps)<=.002||Math.max(...gaps)/Math.min(...gaps)>3.4)return {values:null,status:'irregular_row_spacing'};
 const nums=rows.map(r=>r.choices[0].n);if(name==='receipt')nums.pop();return {values:nums,status:'candidate',count:rows.length};
}
function parse(before,after){
 const drafts=Object.fromEntries(oils.map(x=>[x,{}])),warnings=[],details={};
 if(!before||!after)return {drafts,warnings:['写真2枚が必要です'],details,completeColumns:0};
 function group(page,key,first,second){
 const a=extract(page,first),b=second?extract(page,second):null;details[key]={first:a,second:b};
 if(a.values&&b?.values){if(a.values.every((v,i)=>v===b.values[i]))return a.values;
 warnings.push(key+'：帳票内の上段と下段が一致しません。原票を確認してください。');return null;}
 if(a.values)return a.values;
 if(b?.values){warnings.push(key+'：片方の表のみ認識できました。要確認。');return b.values;}
 warnings.push(key+'：行が認識できませんでした。手入力してください。');return null;
 }
 const columns={A:group(before,'A','main','physical'),B:group(before,'B','receipt'),C:group(after,'C','main','physical'),D:group(after,'D','receipt'),Q:group(after,'Q','quantity')};
 for(const [key,values] of Object.entries(columns))if(values)values.forEach((v,i)=>{drafts[oils[i]][key]=String(v);});
 for(const oil of oils){const d=drafts[oil];
 if(d.A!==undefined&&d.B!==undefined&&Math.abs(+d.B-+d.A)>200)warnings.push(oil+'：荷卸し前の差が大きいため要確認。');
 if(d.C!==undefined&&d.D!==undefined&&Math.abs(+d.D-+d.C)>200)warnings.push(oil+'：荷卸し後の差が大きいため要確認。');}
 return {drafts,warnings,details,completeColumns:Object.values(columns).filter(Boolean).length};
}
return {parse,extract,zones,tokens,numeric};
});