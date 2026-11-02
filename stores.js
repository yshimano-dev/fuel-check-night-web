/* 管理者承認済み店舗リスト。GitHubの書込権限を持つ管理者のみ更新。
   店舗名・タンク構成・許容範囲などの公開可能な設定のみ。担当者コードは入れない。 */
(function(root){
 const stores=[
   {
     id:"ito",
     name:"DDセルフ伊都店",
     tanks:[
       {no:1,capacity:"14KL",oil:"H"},
       {no:2,capacity:"48KL",oil:"R"},
       {no:3,capacity:"14KL",oil:"D"},
       {no:10,capacity:"20KL",oil:"K"}
     ]
   }
 ];
 root.FUEL_APPROVED_STORES=Object.freeze(stores.map(s=>Object.freeze({
   ...s,tanks:Object.freeze(s.tanks.map(t=>Object.freeze({...t})))
 })));
})(window);