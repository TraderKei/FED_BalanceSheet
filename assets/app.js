(function(){
  'use strict';
  const {createApp,ref,computed,watch,onMounted,onBeforeUnmount}=Vue;
  const D=window.FED_DATA,I=window.FED_I18N;
  const tr=(key,lang)=>I[key]?.[lang]??key;
  const finite=D.finite;
  const number=(v,digits=1)=>finite(v)?v.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'N/A';
  const money=(v,unit='B',digits=1)=>finite(v)?'$'+number(v/(unit==='T'?1e6:1000),digits)+unit:'N/A';
  const signed=(v,digits=1)=>finite(v)?(v>0?'+':v<0?'−':'')+money(Math.abs(v),'B',digits===1&&Math.abs(v)>0&&Math.abs(v)<100?3:digits):'N/A';
  const pct=(v,base)=>{const p=D.percent(v,base);return p===null?'N/A':(p>0?'+':p<0?'−':'')+number(Math.abs(p),2)+'%';};
  const TimeChart={
    props:{rows:Array,allRows:Array,field:String,label:String,lang:String,color:{default:'var(--primary)'},height:{default:180},stacked:Boolean,zoomable:Boolean,crosshair:Boolean},
    emits:['zoom'],
    setup(props,{emit}){
      const host=ref(null),width=ref(700),hover=ref(-1),drag=ref(null);let observer;
      const H=computed(()=>props.height),left=48,right=12,top=20;
      const plotBottom=computed(()=>H.value-25);
      const values=computed(()=>props.rows.map(r=>r[props.field]).filter(finite));
      const bounds=computed(()=>{if(!values.value.length)return [0,1];const lo=props.stacked?0:Math.min(...values.value),hi=Math.max(...values.value),padding=(hi-lo||Math.abs(hi)*.01||1000)*.12;return [props.stacked?0:Math.max(0,lo-padding),hi+padding];});
      const unit=computed(()=>Math.max(...values.value)>=1000000?'T':'B');
      const divisor=computed(()=>unit.value==='T'?1e6:1000);
      const x=i=>left+(width.value-left-right)*i/Math.max(1,props.rows.length-1);
      const y=v=>top+(plotBottom.value-top)*(1-(v-bounds.value[0])/(bounds.value[1]-bounds.value[0]));
      const ticks=computed(()=>Array.from({length:4},(_,i)=>{const v=bounds.value[0]+(bounds.value[1]-bounds.value[0])*i/3;return {y:y(v),label:number(v/divisor.value,unit.value==='T'?2:0)};}));
      const dateTicks=computed(()=>{const count=width.value<430?3:6;return [...new Set(Array.from({length:count},(_,i)=>Math.round((props.rows.length-1)*i/(count-1))))].filter(i=>i>=0).map(i=>({x:x(i),text:props.rows[i]?.date.slice(0,7)}));});
      const path=computed(()=>{let previous=false;return props.rows.map((r,i)=>{if(!finite(r[props.field])){previous=false;return '';}const command=previous?'L':'M';previous=true;return command+x(i).toFixed(2)+','+y(r[props.field]).toFixed(2);}).join(' ');});
      const area=computed(()=>{
        const segments=[];let segment=[];props.rows.forEach((r,i)=>{if(finite(r[props.field]))segment.push([i,r[props.field]]);else if(segment.length){segments.push(segment);segment=[];}});if(segment.length)segments.push(segment);
        return segments.map(s=>'M'+x(s[0][0])+','+plotBottom.value+' '+s.map(([i,v])=>'L'+x(i)+','+y(v)).join(' ')+' L'+x(s.at(-1)[0])+','+plotBottom.value+' Z').join(' ');
      });
      const stackPaths=computed(()=>{
        const keys=['treasurySecurities','mortgageBackedSecurities','assetMixOther'];
        return keys.map((key,k)=>{
          const parts=[];let segment=[];
          const flush=()=>{if(!segment.length)return;const upper=segment.map(({r,i})=>[x(i),y(keys.slice(0,k+1).reduce((s,f)=>s+r[f],0))]);const lower=segment.map(({r,i})=>[x(i),y(keys.slice(0,k).reduce((s,f)=>s+r[f],0))]).reverse();parts.push('M'+[...upper,...lower].map(p=>p.join(',')).join(' L')+' Z');segment=[];};
          props.rows.forEach((r,i)=>{if(keys.every(f=>finite(r[f])))segment.push({r,i});else flush();});flush();
          return {key,path:parts.join(' '),color:['var(--chart-treasury)','var(--chart-mbs)','var(--chart-other)'][k]};
        });
      });
      const active=computed(()=>props.rows[hover.value]);
      const previous=computed(()=>active.value?(props.allRows||props.rows).find(r=>r.date===D.iso(Date.parse(active.value.date)-7*86400000)):null);
      const tooltipStyle=computed(()=>({left:Math.min(Math.max(0,x(hover.value)+12),Math.max(0,width.value-(props.stacked?285:195)))+'px'}));
      const chartPoint=event=>{const box=host.value.querySelector('svg').getBoundingClientRect();return {x:(event.clientX-box.left)*width.value/box.width,y:(event.clientY-box.top)*H.value/box.height};};
      const indexAt=point=>Math.min(props.rows.length-1,Math.max(0,Math.round((point.x-left)/(width.value-left-right)*(props.rows.length-1))));
      function locate(event){if(!props.rows.length)return;hover.value=indexAt(chartPoint(event));if(drag.value)drag.value.end=hover.value;}
      function pointerDown(event){if(!props.zoomable||event.button!==0||props.rows.length<2)return;const point=chartPoint(event);if(point.x<left||point.x>width.value-right||point.y<top||point.y>plotBottom.value)return;const start=indexAt(point);drag.value={start,end:start,x:point.x};event.currentTarget.setPointerCapture(event.pointerId);}
      function pointerUp(event){if(!drag.value)return;const start=drag.value.start,end=indexAt(chartPoint(event)),distance=Math.abs(chartPoint(event).x-drag.value.x);drag.value=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(distance<8||start===end)return;const [first,last]=[start,end].sort((a,b)=>a-b);emit('zoom',{start:props.rows[first].date,end:props.rows[last].date});}
      function pointerCancel(){drag.value=null;}
      function keydown(event){if(['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key))event.preventDefault();if(event.key==='Escape'){hover.value=-1;return;}if(event.key==='Home')hover.value=0;else if(event.key==='End')hover.value=props.rows.length-1;else if(event.key==='ArrowLeft')hover.value=Math.max(0,(hover.value<0?props.rows.length:hover.value)-1);else if(event.key==='ArrowRight')hover.value=Math.min(props.rows.length-1,hover.value+1);}
      watch(()=>props.rows,()=>{hover.value=-1;drag.value=null;});
      onMounted(()=>{observer=new ResizeObserver(entries=>width.value=Math.max(200,entries[0].contentRect.width));observer.observe(host.value);});
      onBeforeUnmount(()=>observer?.disconnect());
      return {host,width,H,left,right,plotBottom,x,y,ticks,dateTicks,path,area,stackPaths,active,previous,hover,drag,tooltipStyle,unit,locate,pointerDown,pointerUp,pointerCancel,keydown,money,signed,pct,finite,t:key=>tr(key,props.lang)};
    },
    template:`<div class="time-chart" ref="host" :class="{zoomable}" :style="{'--chart-height':height+'px'}"><span class="chart-unit">USD {{unit==='T'?'trillions':'billions'}}</span>
      <svg :viewBox="'0 0 '+width+' '+height" role="img" tabindex="0" :aria-label="label+' · '+t(zoomable?'zoomHelp':'chartHelp')" @pointermove="locate" @pointerleave="hover=-1" @pointerdown="pointerDown" @pointerup="pointerUp" @pointercancel="pointerCancel" @keydown="keydown" @focus="hover=rows.length-1" @blur="hover=-1">
        <title>{{label}}</title><desc>{{rows[0]?.date}} – {{rows[rows.length-1]?.date}}. {{rows.length}} {{t('observations')}}. {{t('actual')}}.</desc>
        <g v-for="tick in ticks" :key="tick.y"><line class="chart-grid" :x1="left" :x2="width-right" :y1="tick.y" :y2="tick.y"/><text class="chart-label" :x="left-8" :y="tick.y+3" text-anchor="end">{{tick.label}}</text></g>
        <template v-if="stacked"><path v-for="s in stackPaths" :key="s.key" :d="s.path" :fill="s.color" opacity=".8"/></template>
        <template v-else><path :d="area" :fill="color" opacity=".06"/><path :d="path" fill="none" :stroke="color" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></template>
        <g v-for="tick in dateTicks" :key="tick.x"><text class="chart-label" :x="tick.x" :y="height-6" :text-anchor="tick.x===left?'start':tick.x===width-right?'end':'middle'">{{tick.text}}</text></g>
        <rect v-if="drag && drag.start!==drag.end" :x="Math.min(x(drag.start),x(drag.end))" y="20" :width="Math.abs(x(drag.end)-x(drag.start))" :height="plotBottom-20" fill="var(--primary)" opacity=".16" pointer-events="none"/>
        <g v-if="active"><line v-if="crosshair && finite(active[field])" :x1="left" :x2="width-right" :y1="y(active[field])" :y2="y(active[field])" stroke="var(--muted)" stroke-dasharray="3 3"/><line :x1="x(hover)" :x2="x(hover)" y1="20" :y2="plotBottom" stroke="var(--muted)" stroke-dasharray="3 3"/><circle v-if="finite(active[field])" :cx="x(hover)" :cy="y(active[field])" r="3.5" :fill="color" stroke="var(--bg)" stroke-width="2"/></g>
      </svg>
      <div v-if="active" class="chart-tooltip" :style="tooltipStyle" aria-live="polite"><span>{{active.date}} · {{t('actual')}}</span><strong>{{label}} {{money(active[field],'B',2)}}</strong><template v-if="stacked"><div v-for="s in stackPaths" :key="s.key" class="tooltip-row"><span>{{t(s.key==='mortgageBackedSecurities'?'mbsShort':s.key)}}</span><span>{{money(active[s.key],'B',1)}} · {{finite(active[s.key])&&active.totalAssets?(active[s.key]/active.totalAssets*100).toFixed(1)+'%':'N/A'}}</span></div></template><span v-else>{{t('wow')}} {{signed(previous&&finite(previous[field])&&finite(active[field])?active[field]-previous[field]:null,2)}}</span></div>
    </div>`
  };
  function saveFile(content,name,type='text/csv;charset=utf-8'){const blob=new Blob(['\ufeff',content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const storage={get(key,fallback){try{return localStorage.getItem('fed.'+key)||fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('fed.'+key,value);}catch{}}};
  const app=createApp({components:{TimeChart},setup(){
    const lang=ref(storage.get('lang','ko')),theme=ref(storage.get('theme','dark'));
    const snapshot=ref(D.snapshot),meta=computed(()=>snapshot.value?.meta||{}),quality=computed(()=>snapshot.value?.quality||{});
    const rows=ref(D.history),range=ref('2y'),zoom=ref(null),period=ref('1'),state=ref(D.snapshotState(D.snapshot)),notice=ref('');
    const onlineMode=location.protocol==='http:'||location.protocol==='https:',previewMode=new URLSearchParams(location.search).has('preview');
    const sourcesOpen=ref(false),finite=D.finite,tableNumber=value=>finite(value)?number(value/1000,1):'N/A';
    const latest=computed(()=>rows.value.at(-1)||{}),ranges=['6m','1y','2y','5y','max'],stateOptions=['ready','loading','partial','stale','error','empty'];
    const startDate=ref(D.history.length?D.iso(Date.parse(D.history.at(-1).date)-7*86400000):''),endDate=ref(D.history.at(-1)?.date||''),draftStart=ref(startDate.value),draftEnd=ref(endDate.value),dateError=ref(false);
    const driversExpanded=ref(false),allDrivers=ref(false),fullTable=ref(false),treasuryOpen=ref(false),translationDialog=ref(null),translationQuery=ref('');
    const checkedAt=computed(()=>meta.value.fetchedAt?.replace('T',' ').replace('Z',' UTC')||'N/A');let timer;
    const t=key=>tr(key,lang.value);
    function setLang(value){lang.value=value;document.documentElement.lang=value;document.title=t('title')+' | FED Balance Sheet';storage.set('lang',value);}
    function setTheme(value){theme.value=value;document.body.classList.toggle('dark',value==='dark');storage.set('theme',value);}
    setLang(['ko','en'].includes(lang.value)?lang.value:'ko');setTheme(['dark','light'].includes(theme.value)?theme.value:'dark');
    const visibleRows=computed(()=>{const weeks={'6m':26,'1y':52,'2y':104,'5y':260};return range.value==='max'?rows.value:rows.value.slice(-(weeks[range.value]+1));});
    const chartRows=computed(()=>zoom.value?visibleRows.value.filter(r=>r.date>=zoom.value.start&&r.date<=zoom.value.end):visibleRows.value);
    function setRange(value){range.value=value;zoom.value=null;}
    function zoomChart(dates){zoom.value=dates;}
    function resetZoom(){zoom.value=null;}
    const baseline=w=>rows.value.find(r=>r.date===D.iso(Date.parse(latest.value.date)-w*7*86400000));
    const change=(w,key)=>D.delta(latest.value,baseline(w),key);
    const bridge=computed(()=>D.bridge(rows.value,startDate.value,endDate.value));
    const bridgeItems=computed(()=>[
      {key:'totalAssets',field:'totalAssets',prefix:'Δ',value:bridge.value.contributions[0]},
      {key:'tgaShort',field:'treasuryGeneralAccount',prefix:'−Δ',value:bridge.value.contributions[1]},
      {key:'rrpShort',field:'onRrp',prefix:'−Δ',value:bridge.value.contributions[2]},
      {key:'netChange',prefix:'=',value:bridge.value.change}
    ]);
    const displayedDrivers=computed(()=>allDrivers.value?bridge.value.drivers:bridge.value.drivers.slice(0,5));
    const largestDriver=computed(()=>[...bridgeItems.value.slice(0,3)].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))[0]);
    const sameDirection=computed(()=>finite(bridge.value.change)&&finite(D.delta(bridge.value.end,bridge.value.start,'reserveBalances'))?Math.sign(D.delta(bridge.value.end,bridge.value.start,'reserveBalances'))===Math.sign(bridge.value.change):null);
    const pulseState=computed(()=>!finite(bridge.value.change)?'unavailable':bridge.value.change>0?'rising':bridge.value.change<0?'falling':'unchanged');
    const stressItems=computed(()=>['primaryCredit','otherCreditExtensions','centralBankLiquiditySwaps'].map(key=>({key,...D.stress(rows.value,key)})));
    const assetTableKeys=computed(()=>fullTable.value?D.componentKeys:['treasurySecurities','mortgageBackedSecurities','assetMixOther']);
    const liabilityKeys=['reserveBalances','treasuryGeneralAccount','reverseRepoTotal','federalReserveNotes','otherLiabilities','totalCapital'];
    const liabilityTotal=computed(()=>D.sum(liabilityKeys.map(k=>latest.value[k])));
    const balanceDifference=computed(()=>finite(liabilityTotal.value)?latest.value.totalAssets-liabilityTotal.value:null);
    const balanceValid=computed(()=>finite(balanceDifference.value)&&Math.abs(balanceDifference.value)<=5);
    const visibleMissing=computed(()=>visibleRows.value.filter(r=>r.netLiquidity===null).length);
    const sourceRows=computed(()=>Object.entries(snapshot.value?.provenance?.seriesMap||{}).map(([key,v])=>({key,...v})));
    const sourceInputs=computed(()=>['totalAssets','treasuryGeneralAccount','onRrp','netLiquidity','reserveBalances'].map(key=>({key,value:latest.value[key]})));
    const historicalResidual=computed(()=>Math.max(0,...rows.value.map(r=>Math.abs(r.assetReconciliationDifference||0))));
    const translations=computed(()=>Object.entries(I).map(([key,v])=>({key,...v})).filter(r=>Object.values(r).some(v=>v.toLowerCase().includes(translationQuery.value.toLowerCase()))));
    const tone=v=>v===null?'zero':v>0?'positive':v<0?'negative':'zero';
    const barWidth=v=>finite(v)?Math.abs(v)/Math.max(1,...bridgeItems.value.map(i=>Math.abs(i.value)))*100:0;
    const driverWidth=v=>finite(v)?Math.abs(v)/Math.max(1,...bridge.value.drivers.map(d=>Math.abs(d.value)))*100:0;
    const group=key=>['treasurySecurities','mortgageBackedSecurities','agencyDebt'].includes(key)?'securities':['loans','assetRepurchaseAgreements','centralBankLiquiditySwaps'].includes(key)?'credit':'accounting';
    function setPeriod(w){period.value=String(w);endDate.value=latest.value.date;startDate.value=D.iso(Date.parse(endDate.value)-w*7*86400000);draftStart.value=startDate.value;draftEnd.value=endDate.value;dateError.value=false;}
    function applyDates(){dateError.value=!(draftStart.value<draftEnd.value&&[draftStart.value,draftEnd.value].every(d=>rows.value.some(r=>r.date===d)));if(!dateError.value){startDate.value=draftStart.value;endDate.value=draftEnd.value;period.value='custom';}}
    async function refresh(){
      if(state.value==='loading')return;
      state.value='loading';
      try {
        const next=await D.getSnapshot({collect:onlineMode,reload:!onlineMode});
        snapshot.value=next;rows.value=next.history;state.value=D.snapshotState(next);
        if(period.value!=='custom')setPeriod(Number(period.value));
        notice.value=onlineMode?'refreshDone':'snapshotReloaded';
      } catch(error){state.value=rows.value.length?'error':'empty';notice.value='refreshFailed';}
      clearTimeout(timer);timer=setTimeout(()=>notice.value='',5000);
    }
    function reset(){setRange('2y');state.value=D.snapshotState(snapshot.value);setPeriod(1);}
    function exportData(){
      const keys=[...new Set(['date','totalAssets','treasuryGeneralAccount','onRrp','netLiquidity','reserveBalances',...D.componentKeys,'reverseRepoTotal','reverseRepoOthers','onRrpOperationIds','assetReconciliationDifference','liabilityReconciliationDifference'])];
      const csv=[['data_status','unit','fetched_at','h41_release_url',...keys].map(csvCell).join(','),...visibleRows.value.map(r=>['actual','USD millions',meta.value.fetchedAt,meta.value.sourceUrl,...keys.map(k=>Array.isArray(r[k])?r[k].join(';'):r[k])].map(csvCell).join(','))].join('\r\n');
      saveFile(csv,'fed-balance-sheet-ACTUAL-'+latest.value.date+'-'+range.value+'.csv');
    }
    function exportTranslations(){saveFile([['key','ko','en'],...Object.entries(I).map(([key,v])=>[key,v.ko,v.en])].map(r=>r.map(csvCell).join(',')).join('\r\n'),'language-table.csv');}
    function openTranslations(){translationDialog.value.showModal();}
    function closeTranslations(){translationDialog.value.close();}
    function closeOnBackdrop(event){if(event.target===translationDialog.value){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeTranslations();}}
    onMounted(async()=>{if(onlineMode){try{const next=await D.getSnapshot();snapshot.value=next;rows.value=next.history;state.value=D.snapshotState(next);setPeriod(1);}catch{state.value=rows.value.length?'error':'empty';}}});
    onBeforeUnmount(()=>{clearTimeout(timer);});
    return {snapshot,meta,quality,onlineMode,previewMode,sourcesOpen,finite,tableNumber,pulseState,balanceDifference,balanceValid,visibleMissing,sourceRows,sourceInputs,historicalResidual,lang,theme,t,setLang,setTheme,rows,latest,range,ranges,zoom,chartRows,setRange,zoomChart,resetZoom,period,state,stateOptions,notice,checkedAt,visibleRows,baseline,change,startDate,endDate,draftStart,draftEnd,dateError,driversExpanded,allDrivers,fullTable,treasuryOpen,bridge,bridgeItems,displayedDrivers,largestDriver,sameDirection,stressItems,assetTableKeys,liabilityKeys,liabilityTotal,translations,translationDialog,translationQuery,tone,barWidth,driverWidth,group,setPeriod,applyDates,refresh,reset,exportData,exportTranslations,openTranslations,closeTranslations,closeOnBackdrop,number,money,signed,pct};
  }});
  app.mount('#app');
})();
