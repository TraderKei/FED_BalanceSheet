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
    props:{rows:Array,allRows:Array,field:String,label:String,lang:String,color:{default:'var(--primary)'},height:{default:180},stacked:Boolean,zoomable:Boolean,crosshair:Boolean,tooltipLegend:Boolean},
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
      const tooltipStyle=computed(()=>{const tip=props.stacked?285:195,point=x(hover.value),right=point+12+tip<=width.value,left=point-tip-12>=0,side=right?point+12:point-tip-12;return {left:Math.max(0,Math.min(side,width.value-tip))+'px',top:right||left?'22px':'-100px'};});
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
      <div v-if="active" class="chart-tooltip" :style="tooltipStyle" aria-live="polite"><span>{{active.date}} · {{t('actual')}}</span><strong>{{label}} {{money(active[field],'B',2)}}</strong><template v-if="stacked"><div v-for="s in stackPaths" :key="s.key" class="tooltip-row"><span class="tooltip-name"><i v-if="tooltipLegend" class="tooltip-swatch" :style="{backgroundColor:s.color}" aria-hidden="true"></i>{{t(s.key==='mortgageBackedSecurities'?'mbsShort':s.key)}}</span><span>{{money(active[s.key],'B',1)}} · {{finite(active[s.key])&&active.totalAssets?(active[s.key]/active.totalAssets*100).toFixed(1)+'%':'N/A'}}</span></div></template><span v-else>{{t('wow')}} {{signed(previous&&finite(previous[field])&&finite(active[field])?active[field]-previous[field]:null,2)}}</span></div>
    </div>`
  };
  const ObservationDatePicker={
    props:{modelValue:String,dates:Array,label:String,lang:String},
    emits:['update:modelValue'],
    setup(props,{emit}){
      const host=ref(null),open=ref(false),month=ref((props.modelValue||props.dates.at(-1)||'').slice(0,7));
      const available=computed(()=>new Set(props.dates));
      const firstMonth=computed(()=>props.dates[0]?.slice(0,7)||'');
      const lastMonth=computed(()=>props.dates.at(-1)?.slice(0,7)||'');
      const weekdays=computed(()=>props.lang==='ko'?['월','화','수','목','금','토','일']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
      const monthLabel=computed(()=>{const [year,number]=month.value.split('-').map(Number);return props.lang==='ko'?year+'년 '+number+'월':new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(new Date(Date.UTC(year,number-1,1)));});
      const days=computed(()=>{
        const [year,number]=month.value.split('-').map(Number);
        if(!year||!number)return [];
        const offset=(new Date(Date.UTC(year,number-1,1)).getUTCDay()+6)%7;
        const count=new Date(Date.UTC(year,number,0)).getUTCDate();
        return [...Array(offset).fill(null),...Array.from({length:count},(_,i)=>({number:i+1,date:year+'-'+String(number).padStart(2,'0')+'-'+String(i+1).padStart(2,'0')}))];
      });
      function move(delta){const [year,number]=month.value.split('-').map(Number);month.value=new Date(Date.UTC(year,number-1+delta,1)).toISOString().slice(0,7);}
      function select(date){emit('update:modelValue',date);open.value=false;}
      function outside(event){if(!host.value?.contains(event.target))open.value=false;}
      function escape(event){if(event.key==='Escape'){open.value=false;event.stopPropagation();}}
      watch(()=>props.modelValue,value=>{if(value)month.value=value.slice(0,7);});
      onMounted(()=>document.addEventListener('pointerdown',outside));
      onBeforeUnmount(()=>document.removeEventListener('pointerdown',outside));
      return {host,open,month,available,firstMonth,lastMonth,weekdays,monthLabel,days,move,select,escape};
    },
    template:`<div class="observation-picker" ref="host" @keydown="escape">
      <span class="observation-picker-label">{{label}}</span>
      <button type="button" class="observation-date-trigger" :aria-label="label+' '+modelValue" :aria-expanded="open" @click="open=!open">
        <span>{{modelValue}}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor"/><path d="M5 9h2M9 9h2M5 11.5h2" stroke="currentColor"/></svg>
      </button>
      <div v-if="open" class="observation-calendar" role="group" :aria-label="label">
        <div class="observation-calendar-heading"><button type="button" :disabled="month<=firstMonth" :aria-label="lang==='ko'?'이전 달':'Previous month'" @click="move(-1)">‹</button><strong>{{monthLabel}}</strong><button type="button" :disabled="month>=lastMonth" :aria-label="lang==='ko'?'다음 달':'Next month'" @click="move(1)">›</button></div>
        <div class="observation-calendar-grid"><span v-for="day in weekdays" :key="day" class="observation-weekday">{{day}}</span><template v-for="(day,i) in days" :key="i"><span v-if="!day"></span><button v-else type="button" :disabled="!available.has(day.date)" :class="{selected:day.date===modelValue}" :aria-label="day.date" :aria-pressed="day.date===modelValue" @click="select(day.date)">{{day.number}}</button></template></div>
      </div>
    </div>`
  };
  function saveFile(content,name,type='text/csv;charset=utf-8'){const blob=new Blob(['\ufeff',content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const storage={get(key,fallback){try{return localStorage.getItem('fed.'+key)||fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('fed.'+key,value);}catch{}}};
  const app=createApp({components:{TimeChart,ObservationDatePicker},setup(){
    const lang=ref(storage.get('lang','ko')),theme=ref(storage.get('theme','dark'));
    const snapshot=ref(D.snapshot),meta=computed(()=>snapshot.value?.meta||{}),quality=computed(()=>snapshot.value?.quality||{});
    const rows=ref(D.history),range=ref('2y'),zoom=ref(null),chartCustomRange=ref(null),chartDraftStart=ref(''),chartDraftEnd=ref(''),chartDateError=ref(false),period=ref('1'),state=ref(D.snapshotState(D.snapshot)),notice=ref('');
    const onlineMode=location.protocol==='http:'||location.protocol==='https:',previewMode=new URLSearchParams(location.search).has('preview');
    const sourcesOpen=ref(false),finite=D.finite,tableNumber=value=>finite(value)?number(value/1000,1):'N/A';
    const latest=computed(()=>rows.value.at(-1)||{}),availableDates=computed(()=>rows.value.filter(r=>finite(r.netLiquidity)).map(r=>r.date)),ranges=['6m','1y','2y','5y','max'],stateOptions=['ready','loading','partial','stale','error','empty'];
    const startDate=ref(D.history.length?D.iso(Date.parse(D.history.at(-1).date)-7*86400000):''),endDate=ref(D.history.at(-1)?.date||''),draftStart=ref(startDate.value),draftEnd=ref(endDate.value),dateError=ref(false);
    const driversExpanded=ref(false),allDrivers=ref(false),fullTable=ref(false),treasuryOpen=ref(false),translationDialog=ref(null),translationQuery=ref('');
    const checkedAt=computed(()=>meta.value.fetchedAt?.replace('T',' ').replace('Z',' UTC')||'N/A');let timer;
    const t=key=>tr(key,lang.value);
    function setLang(value){lang.value=value;document.documentElement.lang=value;document.title=document.body.dataset.dashboardTitleKey?t(document.body.dataset.dashboardTitleKey):document.body.dataset.dashboardVersion==='v2'?t('v2Title'):t('title')+' | FED Balance Sheet';storage.set('lang',value);}
    function setTheme(value){theme.value=value;document.body.classList.toggle('dark',value==='dark');storage.set('theme',value);}
    setLang(['ko','en'].includes(lang.value)?lang.value:'ko');setTheme(['dark','light'].includes(theme.value)?theme.value:'dark');
    const visibleRows=computed(()=>{const weeks={'6m':26,'1y':52,'2y':104,'5y':260};return range.value==='max'?rows.value:range.value==='custom'&&chartCustomRange.value?rows.value.filter(r=>r.date>=chartCustomRange.value.start&&r.date<=chartCustomRange.value.end):rows.value.slice(-(weeks[range.value]??104)-1);});
    const chartRows=computed(()=>zoom.value?visibleRows.value.filter(r=>r.date>=zoom.value.start&&r.date<=zoom.value.end):visibleRows.value);
    function setRange(value){range.value=value;zoom.value=null;chartDateError.value=false;}
    function selectChartCustom(){const current=chartRows.value.filter(r=>finite(r.netLiquidity));chartDraftStart.value=current[0]?.date||availableDates.value[0]||'';chartDraftEnd.value=current.at(-1)?.date||availableDates.value.at(-1)||'';chartCustomRange.value={start:chartDraftStart.value,end:chartDraftEnd.value};setRange('custom');}
    function applyChartDates(){const selected=availableDates.value.filter(date=>date>=chartDraftStart.value&&date<=chartDraftEnd.value);chartDateError.value=!(chartDraftStart.value<chartDraftEnd.value&&availableDates.value.includes(chartDraftStart.value)&&availableDates.value.includes(chartDraftEnd.value)&&selected.length>=2);if(!chartDateError.value){chartCustomRange.value={start:chartDraftStart.value,end:chartDraftEnd.value};zoom.value=null;}}
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
    const reserveCheckItems=computed(()=>['federalReserveNotes','reverseRepoForeignOfficial','otherLiabilities'].map(key=>({key,start:bridge.value.start?.[key]??null,end:bridge.value.end?.[key]??null,change:D.delta(bridge.value.end,bridge.value.start,key)})));
    const fundingDefinitions=computed(()=>['sofrIorbDefinition','effrIorbDefinition','standingRepoDefinition','fundingInterpretation'].map(t).join('\n\n'));
    const pulseState=computed(()=>!finite(bridge.value.change)?'unavailable':bridge.value.change>0?'rising':bridge.value.change<0?'falling':'unchanged');
    const stressHelp=computed(()=>lang.value==='ko'?'프라이머리 크레딧: 재무상태가 대체로 건전한 예금취급기관에 연준이 담보를 받고 제공하는 대출의 잔액입니다.\n\n기타 신용공여: H.4.1에서 별도로 분류하는 기타 대출 잔액입니다. 포함 범위는 해당 발표의 주석을 따르며, 모든 긴급지원의 합계는 아닙니다.\n\n중앙은행 유동성 스와프: 연준과 해외 중앙은행 간 통화 교환 약정에 따른 미상환 잔액으로, 해외 달러 유동성 공급 등을 보여줍니다.\n\n금액은 수요일 잔액, 옆의 증감은 전주 대비 변화입니다. B는 10억 달러입니다.\n52주 백분위(P)는 최근 52주 내 과거 유효 관측 중 현재보다 낮은 값의 비율입니다. 동률은 낮은 값에 포함하지 않습니다. 최소 26개 관측이 있어야 분류합니다.\n보통: P95 미만, 주의: P95 이상, 높음: P99 이상. 분류는 반올림 전 값으로 계산합니다. 상대적 이용 수준이며 위기 발생 확률이나 안전 판정이 아닙니다.':'Primary credit: collateralized Federal Reserve loans outstanding to generally sound depository institutions.\n\nOther credit extensions: a separate H.4.1 loan category, defined by the release notes; not the total of all emergency support.\n\nCentral bank liquidity swaps: outstanding currency swap arrangements with foreign central banks, including dollar liquidity provision abroad.\n\nAmounts are Wednesday balances; changes compare with the prior week. B means USD billions.\n52-week percentile (P) is the share of prior valid observations in the window strictly below the current value. Ties are excluded from the lower count. At least 26 observations are required.\nNormal: below P95; elevated: P95 or above; high: P99 or above, using unrounded values. This measures relative usage, not crisis probability or a safety assessment.');
    const fundingTrendHelp=computed(()=>lang.value==='ko'?'SOFR: 미국 국채를 담보로 하는 익일물 자금조달 금리.\nEFFR: 무담보 익일물 연방기금 거래의 실효금리.\nIORB: 연준이 은행 지급준비금에 지급하는 금리.\nSRP: 연준 상설레포의 일별 낙찰액 합계.\n\n금리 차이 상승과 SRP 이용 증가가 지속·동반되는지 확인합니다. 단독 수치만으로 준비금 부족이나 위기를 판정하지 않습니다.\n최신 값은 각 지표의 최근 유효 관측이며, 평균은 이를 제외한 직전 20개 유효 관측입니다. 발표 시차로 관측일이 다를 수 있습니다.':'SOFR: overnight Treasury-secured funding rate.\nEFFR: effective unsecured overnight federal funds rate.\nIORB: interest paid by the Fed on reserve balances.\nSRP: total accepted amount in daily standing repo operations.\n\nWatch for persistent, concurrent increases in spreads and SRP usage. No single value diagnoses reserve scarcity or a crisis.\nLatest values use each series’ latest valid observation; averages exclude it and use the prior 20 valid observations. Publication lags can differ.');
    const fundingHover=ref(-1);
    function hoverFundingPoint(event){
      const points=fundingTrend.value.points;
      if(!points.length)return;
      const box=event.currentTarget.getBoundingClientRect();
      const x=(event.clientX-box.left)*570/box.width;
      if(x<45||x>535){fundingHover.value=-1;return;}
      fundingHover.value=points.reduce((best,_,i)=>Math.abs(fundingTrend.value.x(i)-x)<Math.abs(fundingTrend.value.x(best)-x)?i:best,0);
    }
    function keyFundingPoint(event){
      if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key))return;
      event.preventDefault();
      const last=fundingTrend.value.points.length-1;
      if(event.key==='Escape')fundingHover.value=-1;
      else if(event.key==='Home')fundingHover.value=0;
      else if(event.key==='End')fundingHover.value=last;
      else fundingHover.value=Math.max(0,Math.min(last,(fundingHover.value<0?last:fundingHover.value)+(event.key==='ArrowLeft'?-1:1)));
    }
    const fundingTrend=computed(()=>{
      const daily=snapshot.value?.fundingDaily||[],end=daily.at(-1)?.date,points=daily.filter(r=>Date.parse(r.date)>=Date.parse(end)-90*86400000),keys=['sofrIorbSpreadBp','effrIorbSpreadBp'];
      const vals=points.flatMap(r=>keys.map(k=>r[k])).filter(finite),lo=Math.min(-1,...vals)-1,hi=Math.max(1,...vals)+1;
      const x=i=>45+(Date.parse(points[i].date)-Date.parse(points[0].date))*490/Math.max(1,Date.parse(points.at(-1).date)-Date.parse(points[0].date)),y=v=>15+(hi-v)/(hi-lo)*95;
      const path=k=>{
        const segments=[];let segment=[];
        const flush=()=>{if(segment.length)segments.push(segment);segment=[];};
        points.forEach((r,i)=>finite(r[k])?segment.push({x:x(i),y:y(r[k])}):flush());flush();
        return segments.map(data=>{
          if(data.length===1)return `M${data[0].x},${data[0].y}`;
          const slopes=data.slice(1).map((p,i)=>(p.y-data[i].y)/(p.x-data[i].x));
          const tangents=data.map((p,i)=>i===0?slopes[0]:i===data.length-1?slopes.at(-1):slopes[i-1]*slopes[i]<=0?0:2*slopes[i-1]*slopes[i]/(slopes[i-1]+slopes[i]));
          return 'M'+data[0].x+','+data[0].y+data.slice(1).map((p,i)=>{const a=data[i],dx=(p.x-a.x)/3;return ` C${a.x+dx},${a.y+tangents[i]*dx} ${p.x-dx},${p.y-tangents[i+1]*dx} ${p.x},${p.y}`;}).join('');
        }).join(' ');
      };
      const repo=points.map(r=>r.standingRepoUsage).filter(finite),maxRepo=repo.length?Math.max(...repo):null,prior=points.slice(-21,-1);
      return {points,x,y,path,lo,hi,maxRepo,latest:k=>[...daily].reverse().find(r=>finite(r[k])),average:k=>{const latest=[...daily].reverse().find(r=>finite(r[k]));const previous=daily.filter(r=>r.date<latest?.date&&finite(r[k])).slice(-20);return previous.length===20?previous.reduce((a,r)=>a+r[k],0)/20:null;}};
    });
    const stressItems=computed(()=>['primaryCredit','otherCreditExtensions','centralBankLiquiditySwaps'].map(key=>({key,...D.stress(rows.value,key)})));
    const stressBadgeWidth=computed(()=>{
      const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
      context.font='10px sans-serif';
      const widest=Math.max(0,...stressItems.value.map(item=>context.measureText(t(item.state)+' · '+(item.percentile===null?'N/A':'P'+item.percentile)).width));
      return Math.ceil(widest)+22+'px';
    });
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
    const fundingBp=value=>finite(value)?(value>0?'+':value<0?'−':'')+number(Math.abs(value),2)+' bp':'N/A';
    const barWidth=v=>finite(v)?Math.abs(v)/Math.max(1,...bridgeItems.value.map(i=>Math.abs(i.value)))*100:0;
    const driverWidth=v=>finite(v)?Math.abs(v)/Math.max(1,...bridge.value.drivers.map(d=>Math.abs(d.value)))*100:0;
    const group=key=>['treasurySecurities','mortgageBackedSecurities','agencyDebt'].includes(key)?'securities':['loans','assetRepurchaseAgreements','centralBankLiquiditySwaps'].includes(key)?'credit':'accounting';
    function setPeriod(w){period.value=String(w);endDate.value=latest.value.date;startDate.value=D.iso(Date.parse(endDate.value)-w*7*86400000);draftStart.value=startDate.value;draftEnd.value=endDate.value;dateError.value=false;}
    function applyDates(){const selectable=document.body.dataset.dashboardVersion==='v2'?availableDates.value:rows.value.map(r=>r.date);dateError.value=!(draftStart.value<draftEnd.value&&[draftStart.value,draftEnd.value].every(d=>selectable.includes(d)));if(!dateError.value){startDate.value=draftStart.value;endDate.value=draftEnd.value;period.value='custom';}}
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
    return {stressHelp,fundingTrendHelp,fundingTrend,fundingHover,hoverFundingPoint,keyFundingPoint,snapshot,meta,quality,onlineMode,previewMode,sourcesOpen,finite,tableNumber,pulseState,balanceDifference,balanceValid,visibleMissing,sourceRows,sourceInputs,historicalResidual,lang,theme,t,setLang,setTheme,rows,latest,availableDates,range,ranges,zoom,chartCustomRange,chartDraftStart,chartDraftEnd,chartDateError,chartRows,setRange,selectChartCustom,applyChartDates,zoomChart,resetZoom,period,state,stateOptions,notice,checkedAt,visibleRows,baseline,change,startDate,endDate,draftStart,draftEnd,dateError,driversExpanded,allDrivers,fullTable,treasuryOpen,bridge,bridgeItems,displayedDrivers,largestDriver,sameDirection,reserveCheckItems,fundingDefinitions,stressItems,stressBadgeWidth,assetTableKeys,liabilityKeys,liabilityTotal,translations,translationDialog,translationQuery,tone,fundingBp,barWidth,driverWidth,group,setPeriod,applyDates,refresh,reset,exportData,exportTranslations,openTranslations,closeTranslations,closeOnBackdrop,number,money,signed,pct};
  }});
  app.mount('#app');
})();
