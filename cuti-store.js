(function(g){
'use strict';
const D=g.TrackingDomain,A=g.Akses;
const number=v=>Number(v)||0;
const usable=(s,today=D.today())=>number(s.sisa)>0&&s.tanggal_perolehan<=today&&(!s.tanggal_hangus||s.tanggal_hangus>=today);
const oldest=(a,b)=>a.tanggal_perolehan.localeCompare(b.tanggal_perolehan)||a.dibuat_pada.localeCompare(b.dibuat_pada)||a.id.localeCompare(b.id);
function allocation(rows,source,amount,selected='',today=D.today()){
 let remaining=Math.round(number(amount)*100);const result=[];
 for(const s of [...rows].filter(s=>usable(s,today)&&(source==='Gabungan'||s.jenis===source)&&(!selected||s.id===selected)).sort(oldest)){
  if(remaining<=0)break;const take=Math.min(remaining,Math.round(number(s.sisa)*100));result.push({saldo:s,jumlah:take/100});remaining-=take;
 }
 return {rincian:result,kurang:remaining/100};
}
function warning(s,today=D.today()){
 if(!s.tanggal_hangus||number(s.sisa)<=0)return {kind:'',label:''};
 const days=D.dayNumber(s.tanggal_hangus)-D.dayNumber(today);
 if(days<0)return {kind:'expired',label:'Sudah hangus'};
 if(days===0)return {kind:'urgent',label:'Hangus hari ini'};
 if(days<=7)return {kind:'urgent',label:'Hangus '+days+' hari lagi'};
 if(days<=30)return {kind:'near',label:'Hangus '+days+' hari lagi'};
 return {kind:'',label:''};
}
function anniversary(start,n){D.dayNumber(start);const [y,m,d]=start.split('-').map(Number),year=y+n,last=new Date(Date.UTC(year,m,0)).getUTCDate();return year+'-'+String(m).padStart(2,'0')+'-'+String(Math.min(d,last)).padStart(2,'0');}
function tenure(start,today=D.today()){D.dayNumber(today);let n=Number(today.slice(0,4))-Number(start.slice(0,4));if(anniversary(start,n)>today)n--;return Math.max(0,n);}
g.CutiDomain=Object.freeze({usable,oldest,allocation,warning,anniversary,tenure,number});
g.CutiStore=Object.freeze({
 async settings(months,version){return A.rpc('atur_masa_extra',{p_bulan:Number(months),p_versi:version},true);},
 async load(){return A.rpc('data_tahunan_extra',{});},
 async opening(data){return A.rpc('simpan_saldo_awal_tahunan',{p_data:data},true);},
 async extra(data,key,editing){return A.rpc('simpan_extra',{p_data:data,p_kunci:key,...(editing?{p_id:editing.id,p_versi:editing.versi}:{})},true);},
 async use(data,key){return A.rpc('catat_pemakaian_cuti',{p_data:data,p_kunci:key},true);}
});
})(window);
