/* Calculation and data-access layer. Actual source rows are in actual-data.js. */
(function(root){
  'use strict';
  const componentKeys=['treasurySecurities','mortgageBackedSecurities','agencyDebt','loans','assetRepurchaseAgreements','centralBankLiquiditySwaps','unamortizedPremiums','unamortizedDiscounts','msFacilitiesNetPortfolio','otherAssetItems'];
  const iso=date=>new Date(date).toISOString().slice(0,10);
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const net=row=>row&&['totalAssets','treasuryGeneralAccount','onRrp'].every(k=>finite(row[k]))?row.totalAssets-row.treasuryGeneralAccount-row.onRrp:null;
  const delta=(end,start,key)=>end&&start&&finite(end[key])&&finite(start[key])?end[key]-start[key]:null;
  const percent=(value,base)=>!finite(value)||!finite(base)||base===0||base*(base+value)<0?null:value/Math.abs(base)*100;
  const sum=values=>values.every(finite)?values.reduce((a,b)=>a+b,0):null;
  function bridge(rows,startDate,endDate){
    const start=rows.find(r=>r.date===startDate),end=rows.find(r=>r.date===endDate);
    const valid=startDate<endDate&&[startDate,endDate].every(d=>new Date(d+'T00:00:00Z').getUTCDay()===3);
    const drivers=valid&&start&&end?componentKeys.map(key=>({key,value:delta(end,start,key)})).sort((a,b)=>(finite(b.value)?Math.abs(b.value):-1)-(finite(a.value)?Math.abs(a.value):-1)):[];
    const assets=valid?delta(end,start,'totalAssets'):null;
    const driverSum=drivers.length?sum(drivers.map(d=>d.value)):null;
    const difference=finite(assets)&&finite(driverSum)?assets-driverSum:null;
    if(!valid||net(start)===null||net(end)===null)return {start,end,change:null,contributions:[null,null,null],drivers,difference,bridgeDifference:null};
    const contributions=[assets,-delta(end,start,'treasuryGeneralAccount'),-delta(end,start,'onRrp')],change=net(end)-net(start);
    return {start,end,change,contributions,drivers,difference,bridgeDifference:change-sum(contributions)};
  }
  function stress(rows,key){
    const end=rows.at(-1);if(!end||!finite(end[key]))return {value:null,wow:null,percentile:null,state:'insufficient_data'};
    const cutoff=Date.parse(end.date)-51*7*86400000,values=rows.filter(r=>Date.parse(r.date)>=cutoff&&finite(r[key])).map(r=>r[key]);
    const percentile=values.length>=26?100*values.filter(v=>v<end[key]).length/(values.length-1):null;
    const prev=rows.find(r=>r.date===iso(Date.parse(end.date)-7*86400000));
    return {value:end[key],wow:delta(end,prev,key),percentile:percentile===null?null:Math.round(percentile),state:percentile===null?'insufficient_data':percentile>=99?'high':percentile>=95?'elevated':'normal'};
  }
  function validateSnapshot(snapshot){
    if(snapshot?.meta?.status!=='actual'||snapshot.meta.unit!=='USD millions'||snapshot.meta.observationBasis!=='wednesday_level'||!Array.isArray(snapshot.history)||!snapshot.history.length)throw Error('Invalid source snapshot');
    const dates=new Set();let prior='';
    for(const row of snapshot.history){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||new Date(row.date+'T00:00:00Z').getUTCDay()!==3||dates.has(row.date)||row.date<=prior)throw Error('Invalid / duplicate observation date');
      dates.add(row.date);prior=row.date;
      const expected=net(row);
      if(expected===null?row.netLiquidity!==null:!finite(row.netLiquidity)||Math.abs(expected-row.netLiquidity)>1e-6)throw Error('Net liquidity reconciliation failed');
    }
    if(snapshot.history.at(-1).date!==snapshot.meta.observationDate||net(snapshot.history.at(-1))===null)throw Error('Latest inputs are incomplete');
    return snapshot;
  }
  function snapshotState(snapshot,now=Date.now()){
    if(!snapshot?.history?.length)return 'empty';
    if(snapshot.meta.refreshError)return 'error';
    return now-Date.parse(snapshot.meta.observationDate+'T00:00:00Z')>8*86400000?'stale':'ready';
  }
  let snapshot=typeof window==='undefined'?require('../data/normalized/latest.json'):root.FED_SNAPSHOT;
  if(snapshot)validateSnapshot(snapshot);
  async function getSnapshot(options={}){
    if(typeof window==='undefined')return validateSnapshot(snapshot);
    if(location.protocol==='http:'||location.protocol==='https:'){
      const response=await fetch(options.collect?'/api/refresh':'/api/h41',{method:options.collect?'POST':'GET',cache:'no-store',headers:options.collect?{'Content-Type':'application/json','X-FED-Refresh':'1'}:{},...(options.collect?{body:'{}'}:{})});
      if(!response.ok)throw Error('Source refresh failed ('+response.status+')');
      snapshot=validateSnapshot(await response.json());root.FED_SNAPSHOT=snapshot;return snapshot;
    }
    if(options.reload){
      await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/actual-data.js?v='+Date.now();const timer=setTimeout(()=>{script.remove();reject(Error('Snapshot load timed out'));},10000);script.onload=()=>{clearTimeout(timer);script.remove();resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Snapshot file unavailable'));};document.head.appendChild(script);});
      snapshot=validateSnapshot(root.FED_SNAPSHOT);
    }
    return validateSnapshot(snapshot);
  }
  const api={history:snapshot?.history||[],meta:snapshot?.meta||{},snapshot,componentKeys,iso,net,delta,percent,sum,bridge,stress,finite,validateSnapshot,snapshotState,getSnapshot};
  root.FED_DATA=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
