// ===== Chart alapok =====
Chart.register(ChartDataLabels);
Chart.defaults.set("plugins.datalabels", {display:false});
Chart.defaults.font.family = 'Calibri,"Segoe UI",sans-serif';
const el=id=>document.getElementById(id);
const charts={};

// ===== állapot =====
let RAW=[]; window.SHOW_ILLIQUID=false;
let VIEW="a";
const ELEMENTS_A=[], ELEMENTS_B=[];
let CATEGORIES=[],CURRENCIES=[],RISKS=[],MANAGERS=[];
let A7DATA=null;
let WIDTHS={}; try{ WIDTHS=JSON.parse(localStorage.getItem("colw")||"{}"); }catch(e){}

function cmp(x,y,dir){ if(x==null)return 1; if(y==null)return -1;
  if(typeof x==="string")return x.localeCompare(y,"hu")*dir; return (x-y)*dir; }
const uniq=k=>[...new Set(RAW.map(r=>r[k]).filter(v=>v!=null&&v!==""))];
const riskOpt=v=>riskCircle(v);
const isGranit=r=>{const m=(r.manager||"").toLowerCase(); return m.includes("gránit")||m.includes("granit");};

// ===== tábla-segédek =====
function tcell(r,c){ const v=r[c.key];
  switch(c.type){
    case "risk": return riskCircle(v);
    case "pct": return fmt.pct(v,1); case "pct2": return fmt.pct(v,2);
    case "num2": return fmt.num(v,2); case "mrd": return fmt.mrd(v);
    case "days": return fmt.days(v); case "int": return (v==null?"–":Math.round(v));
    default: return fmt.txt(v);
  }}
function attachResize(prefix,cols){
  const cg=el(prefix+"-cg");
  document.querySelectorAll("#"+prefix+"-h th").forEach((th,i)=>{
    const rz=th.querySelector(".rz"); if(!rz)return;
    rz.onpointerdown=e=>{ e.preventDefault(); e.stopPropagation();
      const sx=e.clientX, col=cg.children[i], sw=col.getBoundingClientRect().width, key=cols[i].key;
      rz.setPointerCapture(e.pointerId);
      const mv=ev=>{ const w=Math.max(44,Math.round(sw+(ev.clientX-sx))); col.style.width=w+"px"; WIDTHS[key]=w; };
      const up=()=>{ rz.releasePointerCapture(e.pointerId); rz.onpointermove=null; rz.onpointerup=null;
        try{localStorage.setItem("colw",JSON.stringify(WIDTHS));}catch(e){} };
      rz.onpointermove=mv; rz.onpointerup=up; };
  });
}
function paintGrid(prefix,cols,rows,sortState,onHead){
  el(prefix+"-cg").innerHTML=cols.map(c=>`<col style="width:${(WIDTHS[c.key]||c.w)}px">`).join("");
  el(prefix+"-h").innerHTML="<tr>"+cols.map(c=>{
    const ar=sortState&&c.key===sortState.key?(sortState.dir===1?" ▲":" ▼"):"";
    return `<th data-k="${c.key}" class="${c.num?'r':''}${c.center?' c':''}">${c.label}${ar}<span class="rz"></span></th>`;
  }).join("")+"</tr>";
  el(prefix+"-b").innerHTML=rows.map(r=>"<tr"+(r.__sel?' class="sel-row"':'')+">"+cols.map(c=>{
    let inner=tcell(r,c);
    if(c.link) inner=(r.__sw?`<span class="sw" style="background:${r.__sw}"></span>`:'')+
      `<a href="fund.html?isin=${encodeURIComponent(r.isin)}" title="${(r.name||'').replace(/"/g,'')}">${inner}</a>`;
    const cls=[c.num?"r":"",c.center?"c":"",c.color?pctClass(r[c.key]):""].join(" ").trim();
    return `<td class="${cls}">${inner}</td>`;
  }).join("")+"</tr>").join("");
  if(onHead) document.querySelectorAll("#"+prefix+"-h th").forEach(th=>th.onclick=e=>{
    if(e.target.classList.contains("rz"))return; onHead(th.dataset.k); });
  attachResize(prefix,cols);
}

// ===== chart-segédek =====
function hbar(canvasKey,labels,data,colors,valueFmt,axisTitle){
  if(charts[canvasKey]) charts[canvasKey].destroy();
  charts[canvasKey]=new Chart(el(canvasKey),{type:"bar",
    data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:0,
      datalabels:{display:true,anchor:"end",align:"right",clamp:true,color:"#0D1B1E",font:{weight:"bold",size:11},
        formatter:(v,ctx)=> v==null?"":valueFmt(v,ctx)}}]},
    options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,layout:{padding:{right:74}},
      scales:{x:{title:{display:!!axisTitle,text:axisTitle}},
        y:{ticks:{autoSkip:false,crossAlign:"far",callback:function(val){const l=this.getLabelForValue(val);return (typeof l==="string"&&l.length>24)?l.slice(0,23)+"\u2026":l;}}}},
      plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items[0]?items[0].label:"",label:c=> valueFmt(c.raw,c)}}}}});
}

// ===== szűrés =====
// (filterData a common.js-ben)

// ===== ÖSSZEGZŐ =====
function renderSummary(){
  const base=RAW.filter(r=> window.SHOW_ILLIQUID || !r.is_illiquid);
  const aum=base.reduce((s,r)=>s+(r.aum_huf||0),0);
  const date=base.reduce((m,r)=>(r.obs_date&&r.obs_date>m)?r.obs_date:m,"");
  el("sm-funds").textContent=base.length.toLocaleString("hu-HU");
  el("sm-mgrs").textContent=new Set(base.map(r=>r.manager)).size.toLocaleString("hu-HU");
  el("sm-aum").textContent=fmt.mrd(aum);
  el("sm-date").textContent=date||"–";
}

// ===================== A NÉZET =====================
// 1) Top 15 Alapkezelő AUM szerint — halmozott vízszintes bar + összeg jobbra
function buildA1(){
  const box=el("a1-filters");
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  box.append(fCat.el,fRisk.el);
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk_return:fRisk.getSet()});
    const byMgr={}; d.forEach(r=>{ if(r.aum_huf!=null) byMgr[r.manager]=(byMgr[r.manager]||0)+r.aum_huf; });
    const mgrs=Object.entries(byMgr).sort((a,b)=>b[1]-a[1]).slice(0,15).map(x=>x[0]);
    const cats=[...new Set(d.filter(r=>mgrs.includes(r.manager)&&r.aum_huf!=null).map(r=>r.category))].sort();
    const datasets=cats.map((cat,ci)=>({label:cat,backgroundColor:colorFor(ci),stack:"s",
      data:mgrs.map(m=> d.filter(r=>r.manager===m&&r.category===cat&&r.aum_huf!=null).reduce((s,r)=>s+r.aum_huf/1e9,0))}));
    datasets.push({label:"__total__",data:mgrs.map(()=>0),backgroundColor:"transparent",stack:"s",
      datalabels:{display:true,anchor:"end",align:"right",clamp:true,color:"#0D1B1E",font:{weight:"bold",size:11},
        formatter:(v,ctx)=>{let t=0;ctx.chart.data.datasets.forEach((ds,i)=>{if(ds.label!=="__total__"&&ctx.chart.isDatasetVisible(i))t+=ds.data[ctx.dataIndex]||0;});
          return t>0?t.toLocaleString("hu-HU",{maximumFractionDigits:0}):"";}}});
    if(charts.a1)charts.a1.destroy();
    charts.a1=new Chart(el("a1-canvas"),{type:"bar",data:{labels:mgrs,datasets},
      options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,layout:{padding:{right:84}},
        scales:{x:{stacked:true,title:{display:true,text:"AUM (Mrd Ft)"}},y:{stacked:true}},
        plugins:{legend:{position:"bottom",labels:{filter:it=>it.text!=="__total__"}},
          tooltip:{callbacks:{label:c=> c.dataset.label==="__total__"?null:`${c.dataset.label}: ${c.parsed.x.toLocaleString("hu-HU",{maximumFractionDigits:1})} Mrd Ft`}}}}});
  }
  ELEMENTS_A.push(render);
}

// 2) Top 20 Alap — táblázat (+ Sorozat)
const A2_COLS=[
 {key:"name",label:"Alap",type:"text",link:true,w:190},
 {key:"series",label:"Sorozat",type:"text",w:130},
 {key:"manager",label:"Alapkezelő",type:"text",w:140},
 {key:"category",label:"Kategória",type:"text",w:120},
 {key:"risk_return",label:"Kock.",type:"risk",center:true,w:54},
 {key:"currency",label:"Dev.",type:"text",center:true,w:52},
 {key:"aum_huf",label:"AUM (Mrd Ft)",type:"mrd",num:true,w:104},
 {key:"r_1y",label:"1é hozam",type:"pct",num:true,color:true,w:82},
 {key:"ytd",label:"YTD",type:"pct",num:true,color:true,w:72},
 {key:"vol_1y",label:"Volatilitás",type:"pct",num:true,w:90},
 {key:"sharpe_1y",label:"Sharpe",type:"num2",num:true,w:74},
 {key:"sortino_1y",label:"Sortino",type:"num2",num:true,w:76},
 {key:"ter",label:"TER",type:"pct2",num:true,w:68},
 {key:"max_drawdown",label:"Drawdown",type:"pct",num:true,color:true,w:90},
 {key:"recovery_days",label:"DD duration",type:"days",num:true,w:108},
];
const A2_RANK=[
 {key:"r_1y",label:"1 éves hozam",dir:-1},{key:"aum_huf",label:"AUM",dir:-1},
 {key:"sharpe_1y",label:"Sharpe",dir:-1},{key:"sortino_1y",label:"Sortino",dir:-1},
 {key:"ytd",label:"YTD hozam",dir:-1},{key:"max_drawdown",label:"Drawdown (legkisebb)",dir:-1},
 {key:"recovery_days",label:"DD duration (legkisebb)",dir:1},
];
function buildA2(){
  const box=el("a2-filters");
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  const fCcy=MultiSelect("Deviza",CURRENCIES,{onChange:render});
  const fMgr=MultiSelect("Alapkezelő",MANAGERS,{onChange:render});
  box.append(fCat.el,fRisk.el,fCcy.el,fMgr.el);
  const rs=el("a2-rank"); rs.innerHTML=A2_RANK.map(o=>`<option value="${o.key}">${o.label}</option>`).join("");
  let sort={key:"r_1y",dir:-1}; rs.value=sort.key;
  rs.onchange=()=>{const o=A2_RANK.find(o=>o.key===rs.value);sort={key:o.key,dir:o.dir};render();};
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk_return:fRisk.getSet(),currency:fCcy.getSet(),manager:fMgr.getSet()});
    const rows=[...d].sort((a,b)=>cmp(a[sort.key],b[sort.key],sort.dir)).slice(0,20);
    paintGrid("a2",A2_COLS,rows,sort,(k)=>{
      const textCol=["name","series","manager","category","currency","risk_return"].includes(k);
      if(k===sort.key)sort.dir=-sort.dir; else sort={key:k,dir:textCol?1:-1};
      const o=A2_RANK.find(o=>o.key===k); if(o)rs.value=k; render();
    });
  }
  ELEMENTS_A.push(render);
}

// 3) Top 15 Alapkezelő — választható metrika, per-alapkezelő szín, érték jobbra
const A3_M=[
 {key:"aum",label:"AUM",toBar:v=>v/1e9,fmt:v=>fmt.mrd(v)+" Mrd Ft",axis:"AUM (Mrd Ft)"},
 {key:"wsharpe",label:"AUM-súlyozott Sharpe",toBar:v=>v,fmt:v=>fmt.num(v,2),axis:"Sharpe"},
 {key:"wter",label:"TER (AUM-súlyozott)",toBar:v=>v*100,fmt:v=>fmt.pct(v,2),axis:"TER (%)"},
];
function aggMgr(d){ const m={};
  d.forEach(r=>{ (m[r.manager] ||= {aum:0,ssn:0,ssd:0,stn:0,std:0}); const g=m[r.manager];
    if(r.aum_huf!=null){ g.aum+=r.aum_huf;
      if(r.sharpe_1y!=null){g.ssn+=r.aum_huf*r.sharpe_1y;g.ssd+=r.aum_huf;}
      if(r.ter!=null){g.stn+=r.aum_huf*r.ter;g.std+=r.aum_huf;} } });
  return Object.entries(m).map(([manager,g])=>({manager,aum:g.aum,
    wsharpe:g.ssd>0?g.ssn/g.ssd:null,wter:g.std>0?g.stn/g.std:null})); }
function buildA3(){
  const box=el("a3-filters");
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  const fCcy=MultiSelect("Deviza",CURRENCIES,{onChange:render});
  box.append(fCat.el,fRisk.el,fCcy.el);
  const sel=el("a3-rank"); sel.innerHTML=A3_M.map(o=>`<option value="${o.key}">${o.label}</option>`).join("");
  let metric=A3_M[0]; sel.value=metric.key; sel.onchange=()=>{metric=A3_M.find(o=>o.key===sel.value);render();};
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk_return:fRisk.getSet(),currency:fCcy.getSet()});
    const rows=aggMgr(d).filter(x=>x[metric.key]!=null).sort((a,b)=>b[metric.key]-a[metric.key]).slice(0,15);
    hbar("a3-canvas",rows.map(r=>r.manager),rows.map(r=>metric.toBar(r[metric.key])),
      rows.map((_,i)=>colorFor(i)),(v,ctx)=>metric.fmt(rows[ctx.dataIndex][metric.key]),metric.axis);
  }
  ELEMENTS_A.push(render);
}

// 4) Kockázat–hozam térkép — bubble (szín=alapkezelő, jelmagyarázat kapcsolható)
function buildA4(){
  const box=el("a4-filters");
  const defCat=CATEGORIES.find(c=>c.toLowerCase().includes("abszol"))||CATEGORIES[0];
  const fCat=MultiSelect("Kategória",CATEGORIES,{single:true,defaultSel:[defCat],onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  const fCcy=MultiSelect("Deviza",CURRENCIES,{onChange:render});
  box.append(fCat.el,fRisk.el,fCcy.el);
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk_return:fRisk.getSet(),currency:fCcy.getSet()}).filter(r=>r.vol_1y!=null&&r.r_1y!=null);
    const aums=d.map(r=>r.aum_huf||0),mn=Math.min(...aums,0),mx=Math.max(...aums,1);
    const rad=a=> d.length<=1?14:6+22*Math.sqrt(((a||0)-mn)/((mx-mn)||1));
    const mgrs=[...new Set(d.map(r=>r.manager))];
    const datasets=mgrs.map((m,i)=>({label:m,backgroundColor:colorFor(i)+"cc",borderColor:colorFor(i),
      data:d.filter(r=>r.manager===m).map(r=>({x:r.vol_1y*100,y:r.r_1y*100,r:rad(r.aum_huf),name:r.name,series:r.series,aum:r.aum_huf}))}));
    if(charts.a4)charts.a4.destroy();
    charts.a4=new Chart(el("a4-canvas"),{type:"bubble",data:{datasets},
      options:{responsive:true,maintainAspectRatio:false,
        scales:{x:{title:{display:true,text:"Volatilitás (%)"}},y:{title:{display:true,text:"1 éves hozam (%)"}}},
        plugins:{legend:{position:"bottom"},datalabels:{display:false},
          tooltip:{callbacks:{label:c=>{const p=c.raw;return `${p.name}${p.series?" ("+p.series+")":""}: vol ${p.x.toFixed(1)}%, hozam ${p.y.toFixed(1)}%, AUM ${fmt.mrd(p.aum)} Mrd`;}}}}}});
  }
  ELEMENTS_A.push(render);
}

// 5) AUM megoszlása kategóriánként — fánk
function buildA5(){
  const box=el("a5-filters");
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  const fCcy=MultiSelect("Deviza",CURRENCIES,{onChange:render});
  box.append(fRisk.el,fCcy.el);
  function render(){
    const d=filterData(RAW,{risk_return:fRisk.getSet(),currency:fCcy.getSet()});
    const by={}; d.forEach(r=>{ if(r.aum_huf!=null) by[r.category]=(by[r.category]||0)+r.aum_huf; });
    const ent=Object.entries(by).sort((a,b)=>b[1]-a[1]);
    if(charts.a5)charts.a5.destroy();
    charts.a5=new Chart(el("a5-canvas"),{type:"doughnut",
      data:{labels:ent.map(e=>e[0]),datasets:[{data:ent.map(e=>e[1]),backgroundColor:ent.map((_,i)=>colorFor(i)),borderWidth:1,borderColor:"#fff"}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:"right"},
          datalabels:{display:true,color:"#fff",font:{weight:"bold",size:11},
            formatter:(v,ctx)=>{const t=ctx.dataset.data.reduce((s,x)=>s+x,0);const p=t?v/t*100:0;return p>=5?p.toFixed(0)+"%":"";}},
          tooltip:{callbacks:{label:c=>`${c.label}: ${fmt.mrd(c.raw)} Mrd Ft`}}}}});
  }
  ELEMENTS_A.push(render);
}

// 6) Legnagyobb nettó forgalom – 30 nap (be- és kiáramlás)
function buildA6(){
  const box=el("a6-filters");
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  const fCcy=MultiSelect("Deviza",CURRENCIES,{onChange:render});
  const fMgr=MultiSelect("Alapkezelő",MANAGERS,{onChange:render});
  box.append(fCat.el,fRisk.el,fCcy.el,fMgr.el);
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk_return:fRisk.getSet(),currency:fCcy.getSet(),manager:fMgr.getSet()}).filter(r=>r.turnover_cum_30d_huf!=null&&r.turnover_cum_30d_huf!==0);
    const sorted=[...d].sort((a,b)=>b.turnover_cum_30d_huf-a.turnover_cum_30d_huf);
    const top=sorted.slice(0,10), bottom=sorted.slice(-10).filter(r=>r.turnover_cum_30d_huf<0);
    const rows=[...top,...bottom.reverse()];
    hbar("a6-canvas",rows.map(r=>r.name),rows.map(r=>r.turnover_cum_30d_huf/1e9),
      rows.map(r=> r.turnover_cum_30d_huf>=0?"#2E8B6B":"#c62828"),
      (v)=> (v>=0?"+":"")+v.toLocaleString("hu-HU",{maximumFractionDigits:2}),"Nettó forgalom (Mrd Ft)");
  }
  ELEMENTS_A.push(render);
}


// 7) Piac alakulása — teljes piaci AUM vonaldiagram (időszak + kategória szűrő)
const A7_RANGES=[{m:3,label:"Elmúlt 3 hónap"},{m:6,label:"Elmúlt 6 hónap"},{m:12,label:"Elmúlt 1 év"},{m:36,label:"Elmúlt 3 év"}];
function buildA7(){
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  el("a7-filters").append(fCat.el);
  const rs=el("a7-range");
  rs.innerHTML=A7_RANGES.map(o=>`<option value="${o.m}">${o.label}</option>`).join("");
  rs.value="12"; rs.onchange=render;
  async function ensure(){
    if(A7DATA) return;
    const d=new Date(); d.setFullYear(d.getFullYear()-3); const from=d.toISOString().slice(0,10);
    A7DATA=await sbGetAll(`market_aum_daily?obs_date=gte.${from}&select=obs_date,category,aum_huf,turnover_huf&order=obs_date.asc`);
  }
  async function render(){
    const note=el("a7-note");
    try{ await ensure(); }
    catch(e){ note.hidden=false; note.textContent='A Piac alakulása nézethez létre kell hozni a market_aum_daily táblát (lásd az SQL lépést).'; if(charts.a7){charts.a7.destroy();charts.a7=null;} return; }
    note.hidden=true;
    const months=parseInt(rs.value,10);
    const cut=new Date(); cut.setMonth(cut.getMonth()-months); const cutS=cut.toISOString().slice(0,10);
    const sel=fCat.getSet(), perDate={};
    A7DATA.forEach(r=>{ if(r.obs_date<cutS) return; if(sel.size>0 && !sel.has(String(r.category))) return;
      perDate[r.obs_date]=(perDate[r.obs_date]||0)+Number(r.aum_huf||0); });
    const allDates=Object.keys(perDate).sort();
    const dates=allDates.slice(0, Math.max(0, allDates.length-5)); // utolsó 5 nap levágva (hiányos adat)
    const vals=dates.map(dt=>perDate[dt]/1e9);
    if(charts.a7)charts.a7.destroy();
    charts.a7=new Chart(el("a7-canvas"),{type:"line",
      data:{labels:dates,datasets:[{label:"Össz piaci AUM (Mrd Ft)",data:vals,
        borderColor:"#00474F",backgroundColor:"rgba(0,71,79,.12)",fill:true,pointRadius:0,borderWidth:2,tension:.2}]},
      options:{responsive:true,maintainAspectRatio:false,
        interaction:{mode:"index",intersect:false},
        scales:{x:{ticks:{maxTicksLimit:9,autoSkip:true}},y:{title:{display:true,text:"AUM (Mrd Ft)"}}},
        plugins:{legend:{display:false},datalabels:{display:false},
          tooltip:{mode:"index",intersect:false,yAlign:"bottom",displayColors:false,
            callbacks:{title:items=>items[0]?items[0].label:"",label:c=>c.parsed.y.toLocaleString("hu-HU",{maximumFractionDigits:0})+" Mrd Ft"}}}}});
  }
  ELEMENTS_A.push(render);
}

// 8) Alapkezelők nettó forgalom – 30 nap
function buildA8(){
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  const fCcy=MultiSelect("Deviza",CURRENCIES,{onChange:render});
  el("a8-filters").append(fCat.el,fRisk.el,fCcy.el);
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk_return:fRisk.getSet(),currency:fCcy.getSet()});
    const by={}; d.forEach(r=>{ if(r.turnover_cum_30d_huf!=null) by[r.manager]=(by[r.manager]||0)+r.turnover_cum_30d_huf; });
    const arr=Object.entries(by).map(([m,v])=>({manager:m,val:v})).filter(x=>x.val!==0).sort((a,b)=>b.val-a.val);
    const rows=[...arr.slice(0,10),...arr.slice(-10).filter(x=>x.val<0).reverse()];
    hbar("a8-canvas",rows.map(r=>r.manager),rows.map(r=>r.val/1e9),
      rows.map(r=>r.val>=0?"#2E8B6B":"#c62828"),
      (v)=>(v>=0?"+":"")+v.toLocaleString("hu-HU",{maximumFractionDigits:2}),"Nettó forgalom (Mrd Ft)");
  }
  ELEMENTS_A.push(render);
}

// 9) Piac alakulása kategóriánként — halmozott oszlop (havi pillanatképek)
function buildA9(){
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  el("a9-filters").append(fCat.el);
  const rs=el("a9-range"); rs.innerHTML=A7_RANGES.map(o=>`<option value="${o.m}">${o.label}</option>`).join("");
  rs.value="12"; rs.onchange=render;
  async function ensure(){ if(A7DATA) return;
    const d=new Date(); d.setFullYear(d.getFullYear()-3); const from=d.toISOString().slice(0,10);
    A7DATA=await sbGetAll(`market_aum_daily?obs_date=gte.${from}&select=obs_date,category,aum_huf,turnover_huf&order=obs_date.asc`); }
  async function render(){
    const note=el("a9-note");
    try{ await ensure(); }catch(e){ note.hidden=false; note.textContent="Ehhez a nézethez létre kell hozni a market_aum_daily táblát (lásd az SQL lépést)."; if(charts.a9){charts.a9.destroy();charts.a9=null;} return; }
    note.hidden=true;
    const months=parseInt(rs.value,10);
    const cut=new Date(); cut.setMonth(cut.getMonth()-months); const cutS=cut.toISOString().slice(0,10);
    const sel=fCat.getSet();
    const rows=A7DATA.filter(r=> r.obs_date>=cutS && (sel.size===0||sel.has(String(r.category))));
    const dateCat={};
    rows.forEach(r=>{ (dateCat[r.obs_date] ||= {}); dateCat[r.obs_date][r.category]=(dateCat[r.obs_date][r.category]||0)+Number(r.aum_huf||0); });
    let dates=Object.keys(dateCat).sort();
    dates=dates.slice(0, Math.max(0, dates.length-5)); // utolsó 5 nap levágva (hiányos adat)
    const cats=[...new Set(rows.map(r=>r.category))].sort();
    const datasets=cats.map((cat,ci)=>({label:cat,borderColor:colorFor(ci),backgroundColor:colorFor(ci)+"99",
      data:dates.map(dt=> (dateCat[dt][cat]||0)/1e9), fill:true, pointRadius:0, borderWidth:1, tension:.2, stack:"s"}));
    if(charts.a9)charts.a9.destroy();
    charts.a9=new Chart(el("a9-canvas"),{type:"line",data:{labels:dates,datasets},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
        scales:{x:{ticks:{maxTicksLimit:9,autoSkip:true}},y:{stacked:true,title:{display:true,text:"AUM (Mrd Ft)"}}},
        plugins:{legend:{position:"bottom"},datalabels:{display:false},
          tooltip:{mode:"index",intersect:false,callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y.toLocaleString("hu-HU",{maximumFractionDigits:0})} Mrd Ft`}}}}});
  }
  ELEMENTS_A.push(render);
}

// 11) Kategória-összevetés — táblázat + választható mutató bar
const A11_COLS=[
 {key:"category",label:"Kategória",type:"text",w:200},
 {key:"aum",label:"AUM (Mrd Ft)",type:"mrd",num:true,w:110},
 {key:"r_1y",label:"1é hozam*",type:"pct",num:true,color:true,w:88},
 {key:"vol_1y",label:"Volatilitás*",type:"pct",num:true,w:100},
 {key:"sharpe_1y",label:"Sharpe*",type:"num2",num:true,w:82},
 {key:"ter",label:"TER*",type:"pct2",num:true,w:74},
 {key:"turn3m",label:"3 havi forgalom (Mrd Ft)",type:"mrd",num:true,w:160},
];
const A11_M=[
 {key:"r_1y",label:"1 éves hozam (AUM-súly.)",toBar:v=>v*100,barFmt:v=>v.toFixed(1)+"%",axis:"1 éves hozam (%)"},
 {key:"vol_1y",label:"Volatilitás (AUM-súly.)",toBar:v=>v*100,barFmt:v=>v.toFixed(1)+"%",axis:"Volatilitás (%)"},
 {key:"sharpe_1y",label:"Sharpe (AUM-súly.)",toBar:v=>v,barFmt:v=>v.toFixed(2),axis:"Sharpe"},
 {key:"ter",label:"TER (AUM-súly.)",toBar:v=>v*100,barFmt:v=>v.toFixed(2)+"%",axis:"TER (%)"},
 {key:"turn3m",label:"3 havi forgalom (Mrd Ft)",toBar:v=>v/1e9,barFmt:v=>v.toLocaleString("hu-HU",{maximumFractionDigits:1}),axis:"Forgalom (Mrd Ft)"},
];
function buildAcat(){
  const selM=el("a11-metric"); selM.innerHTML=A11_M.map(o=>`<option value="${o.key}">${o.label}</option>`).join("");
  let metric=A11_M[0]; selM.value=metric.key; selM.onchange=()=>{metric=A11_M.find(o=>o.key===selM.value);render();};
  let sort={key:"aum",dir:-1};
  async function ensureM(){ if(A7DATA) return;
    const d=new Date(); d.setFullYear(d.getFullYear()-3); const from=d.toISOString().slice(0,10);
    A7DATA=await sbGetAll(`market_aum_daily?obs_date=gte.${from}&select=obs_date,category,aum_huf,turnover_huf&order=obs_date.asc`); }
  async function render(){
    const base=RAW.filter(r=> window.SHOW_ILLIQUID || !r.is_illiquid);
    const agg={};
    base.forEach(r=>{ const c=r.category; if(!c)return;
      (agg[c] ||= {aum:0,wn:{r_1y:0,vol_1y:0,sharpe_1y:0,ter:0},wd:{r_1y:0,vol_1y:0,sharpe_1y:0,ter:0}});
      const g=agg[c]; if(r.aum_huf!=null) g.aum+=r.aum_huf;
      ["r_1y","vol_1y","sharpe_1y","ter"].forEach(k=>{ if(r[k]!=null&&r.aum_huf!=null){ g.wn[k]+=r.aum_huf*r[k]; g.wd[k]+=r.aum_huf; } });
    });
    let turn={};
    try{ await ensureM(); const cut=new Date(); cut.setMonth(cut.getMonth()-3); const cutS=cut.toISOString().slice(0,10);
      A7DATA.forEach(r=>{ if(r.obs_date>=cutS) turn[r.category]=(turn[r.category]||0)+Number(r.turnover_huf||0); });
    }catch(e){}
    const rows=Object.entries(agg).map(([category,g])=>({category,aum:g.aum,
      r_1y:g.wd.r_1y>0?g.wn.r_1y/g.wd.r_1y:null, vol_1y:g.wd.vol_1y>0?g.wn.vol_1y/g.wd.vol_1y:null,
      sharpe_1y:g.wd.sharpe_1y>0?g.wn.sharpe_1y/g.wd.sharpe_1y:null, ter:g.wd.ter>0?g.wn.ter/g.wd.ter:null,
      turn3m: (category in turn)?turn[category]:null }));
    const srt=[...rows].sort((a,b)=>cmp(a[sort.key],b[sort.key],sort.dir));
    paintGrid("a11",A11_COLS,srt,sort,(k)=>{ if(k===sort.key)sort.dir=-sort.dir; else sort={key:k,dir:(k==="category"?1:-1)}; render(); });
    const brows=[...rows].filter(r=>r[metric.key]!=null).sort((a,b)=>b[metric.key]-a[metric.key]);
    hbar("a11-canvas",brows.map(r=>r.category),brows.map(r=>metric.toBar(r[metric.key])),
      brows.map((_,i)=>colorFor(i)),(v)=>metric.barFmt(v),metric.axis);
  }
  ELEMENTS_A.push(render);
}

// ===================== B NÉZET =====================
const B7_COLS=[
 {key:"name",label:"Alap",type:"text",link:true,w:190},
 {key:"series",label:"Sorozat",type:"text",w:130},
 {key:"manager",label:"Alapkezelő",type:"text",w:150},
 {key:"aum_huf",label:"AUM (Mrd Ft)",type:"mrd",num:true,w:104},
 {key:"r_1y",label:"1é hozam",type:"pct",num:true,color:true,w:82},
 {key:"rank_r1y",label:"Hely. (1é)",type:"int",num:true,center:true,w:78},
 {key:"ytd",label:"YTD",type:"pct",num:true,color:true,w:72},
 {key:"vol_1y",label:"Volatilitás",type:"pct",num:true,w:90},
 {key:"sharpe_1y",label:"Sharpe",type:"num2",num:true,w:74},
 {key:"rank_sharpe",label:"Hely. (Sharpe)",type:"int",num:true,center:true,w:96},
 {key:"sortino_1y",label:"Sortino",type:"num2",num:true,w:76},
 {key:"ter",label:"TER",type:"pct2",num:true,w:68},
 {key:"max_drawdown",label:"Drawdown",type:"pct",num:true,color:true,w:90},
 {key:"recovery_days",label:"DD duration",type:"days",num:true,w:108},
];
const B7_SORT=[{key:"sharpe_1y",label:"Sharpe"},{key:"sortino_1y",label:"Sortino"},{key:"r_1y",label:"1 éves hozam"}];
function buildB(){
  const anchors=RAW.filter(r=>isGranit(r)&&r.peer_group_isin)
    .sort((a,b)=>String(a.name+a.series).localeCompare(String(b.name+b.series),"hu"));
  const fsel=el("b6-fund");
  fsel.innerHTML=anchors.map(r=>`<option value="${r.isin}">${r.name}${r.series?" – "+r.series:""}</option>`).join("");
  const def=anchors.find(r=>/harm[oó]nia/i.test(r.name))||anchors[0];
  if(def) fsel.value=def.isin;
  const ssel=el("b7-sort"); ssel.innerHTML=B7_SORT.map(o=>`<option value="${o.key}">${o.label}</option>`).join("");
  let sortKey="sharpe_1y"; ssel.value=sortKey;
  fsel.onchange=render; ssel.onchange=()=>{sortKey=ssel.value; render();};
  function peerGroup(sel){
    const key=sel.peer_group_isin||sel.isin;
    let p=RAW.filter(r=> (r.peer_group_isin||"")===key && (window.SHOW_ILLIQUID || !r.is_illiquid));
    if(!p.some(r=>r.isin===sel.isin)) p.push(sel);
    return p.map(r=>({...r}));
  }
  function render(){
    const sel=RAW.find(r=>r.isin===fsel.value); if(!sel)return;
    el("b6-tile").innerHTML=`<span><b>Kategória:</b> ${fmt.txt(sel.category)}</span>`+
      `<span><b>Kockázat:</b> ${riskCircle(sel.risk_return)}</span>`+`<span><b>Deviza:</b> ${fmt.txt(sel.currency)}</span>`;
    const peers=peerGroup(sel);
    const ordered=[...peers].sort((a,b)=>String(a.name).localeCompare(String(b.name),"hu"));
    const cmap={},cmap2={}; ordered.forEach((r,i)=>{cmap[r.isin]=colorFor(i);cmap2[r.isin]=colorFor(i+5);});
    // helyezések
    const byR=[...peers].filter(r=>r.r_1y!=null).sort((a,b)=>b.r_1y-a.r_1y); byR.forEach((r,i)=>r.rank_r1y=i+1);
    const byS=[...peers].filter(r=>r.sharpe_1y!=null).sort((a,b)=>b.sharpe_1y-a.sharpe_1y); byS.forEach((r,i)=>r.rank_sharpe=i+1);
    // táblázat
    const trows=[...peers].sort((a,b)=>cmp(a[sortKey],b[sortKey],-1));
    trows.forEach(r=>{ r.__sel=(r.isin===sel.isin); r.__sw=cmap[r.isin]; });
    paintGrid("b7",B7_COLS,trows,{key:sortKey,dir:-1},null);
    // bar chartok (érték jobbra, szín alaponként)
    // bar chartok: mutatónként csökkenő sorrend (legmagasabb fent), csak a kiválasztott GAK alap kiemelve
    const HLC="#00474F", BASEC="#B7D3C8";
    const mbar=(canvas,key,toBar,fmtFn,axis)=>{
      const rows=[...peers].filter(r=>r[key]!=null).sort((a,b)=>b[key]-a[key]);
      hbar(canvas,rows.map(r=>r.name),rows.map(r=>toBar(r[key])),
        rows.map(r=>r.isin===sel.isin?HLC:BASEC),fmtFn,axis);
    };
    mbar("b8-canvas","r_1y",v=>v*100,(v)=>v.toFixed(1)+"%","1 éves hozam (%)");
    mbar("b9-canvas","sharpe_1y",v=>v,(v)=>v.toFixed(2),"Sharpe");
    mbar("b10-canvas","sortino_1y",v=>v,(v)=>v.toFixed(2),"Sortino");
    mbar("b11-canvas","ter",v=>v*100,(v)=>v.toFixed(2)+"%","TER (%)");
    mbar("b16-canvas","max_drawdown",v=>v*100,(v)=>v.toFixed(1)+"%","Drawdown (%)");
    mbar("b17-canvas","turnover_cum_30d_huf",v=>v/1e9,(v)=>(v>=0?"+":"")+v.toFixed(2),"30 napos forgalom (Mrd Ft)");
    // bubble
    const aums=peers.map(r=>r.aum_huf||0),mn=Math.min(...aums,0),mx=Math.max(...aums,1);
    const rad=a=> peers.length<=1?16:8+22*Math.sqrt(((a||0)-mn)/((mx-mn)||1));
    const bds=peers.filter(r=>r.vol_1y!=null&&r.r_1y!=null).map(r=>({label:r.name,
      backgroundColor:cmap[r.isin]+"cc",borderColor:cmap[r.isin],
      data:[{x:r.vol_1y*100,y:r.r_1y*100,r:rad(r.aum_huf),name:r.name,series:r.series,aum:r.aum_huf}]}));
    if(charts.b13)charts.b13.destroy();
    charts.b13=new Chart(el("b13-canvas"),{type:"bubble",data:{datasets:bds},
      options:{responsive:true,maintainAspectRatio:false,
        scales:{x:{title:{display:true,text:"Volatilitás (%)"}},y:{title:{display:true,text:"1 éves hozam (%)"}}},
        plugins:{legend:{position:"bottom"},datalabels:{display:false},
          tooltip:{callbacks:{label:c=>{const p=c.raw;return `${p.name}: vol ${p.x.toFixed(1)}%, hozam ${p.y.toFixed(1)}%, AUM ${fmt.mrd(p.aum)} Mrd`;}}}}}});
    // forgalmazás (async)
    renderB12(peers,cmap);
    setupB14(peers,cmap);
    setupB15(peers,cmap);
  }
  ELEMENTS_B.push(render);
}
async function renderB12(peers,cmap){
  const isins=peers.map(r=>r.isin);
  if(!isins.length){ if(charts.b12){charts.b12.destroy();charts.b12=null;} return; }
  const maxd=RAW.reduce((m,r)=>(r.obs_date&&r.obs_date>m)?r.obs_date:m,"");
  const dd=new Date(maxd); dd.setMonth(dd.getMonth()-3); const from=dd.toISOString().slice(0,10);
  const inlist="("+isins.map(x=>`"${x}"`).join(",")+")";
  let rows=[];
  try{ rows=await sbGetAll(`v_fund_full?isin=in.${inlist}&obs_date=gte.${from}&select=isin,obs_date,turnover&order=obs_date.asc`); }
  catch(e){ return; }
  const dates=[...new Set(rows.map(r=>r.obs_date))].sort();
  const byFund={}; peers.forEach(p=>byFund[p.isin]={});
  rows.forEach(r=>{ if(byFund[r.isin]) byFund[r.isin][r.obs_date]=r.turnover; });
  const datasets=peers.map(p=>({label:p.name,borderColor:cmap[p.isin],backgroundColor:cmap[p.isin],
    data:dates.map(dt=> byFund[p.isin][dt]!=null?byFund[p.isin][dt]:null),spanGaps:true,pointRadius:0,borderWidth:2,tension:.2}));
  if(charts.b12)charts.b12.destroy();
  charts.b12=new Chart(el("b12-canvas"),{type:"line",data:{labels:dates,datasets},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
      scales:{x:{ticks:{maxTicksLimit:8,autoSkip:true}},y:{title:{display:true,text:"Napi forgalom"}}},
      plugins:{legend:{position:"bottom"},datalabels:{display:false},tooltip:{mode:"index",intersect:false,yAlign:"bottom"}}}});
}

// 14) 1 éves hozam alakulása — gördülő 1 éves hozam idősor
function rolling1y(dates,prices){
  const out=[]; const c=new Date(); c.setFullYear(c.getFullYear()-1); const cutS=c.toISOString().slice(0,10);
  for(let i=0;i<dates.length;i++){ const D=dates[i]; if(D<cutS) continue; if(prices[i]==null) continue;
    const t=new Date(D); t.setFullYear(t.getFullYear()-1); const target=t.toISOString().slice(0,10);
    let lo=0,hi=i,idx=-1; while(lo<=hi){const m=(lo+hi)>>1; if(dates[m]<=target){idx=m;lo=m+1;}else hi=m-1;}
    if(idx>=0 && prices[idx]>0) out.push({d:D,ret:(prices[i]/prices[idx]-1)*100}); }
  return out;
}
let B14STATE=null;
async function setupB14(peers,cmap2){
  const box=el("b14-filters"); box.innerHTML="";
  const labels=peers.map(p=>p.name+(p.series?" – "+p.series:""));
  const fFund=MultiSelect("Alapok",labels,{onChange:draw});
  box.append(fFund.el);
  if(charts.b14){charts.b14.destroy();charts.b14=null;}
  el("b14-note").hidden=true;
  const isins=peers.map(p=>p.isin);
  const d=new Date(); d.setFullYear(d.getFullYear()-2); d.setMonth(d.getMonth()-1); const from=d.toISOString().slice(0,10);
  const inlist="("+isins.map(x=>`"${x}"`).join(",")+")";
  let rows=[];
  try{ rows=await sbGetAll(`v_fund_full?isin=in.${inlist}&obs_date=gte.${from}&select=isin,obs_date,price&order=obs_date.asc`); }
  catch(e){ el("b14-note").hidden=false; el("b14-note").textContent="A hozamgörbe adatai nem elérhetők."; return; }
  const per={}; peers.forEach(p=>per[p.isin]={d:[],p:[]});
  rows.forEach(r=>{ if(per[r.isin]){ per[r.isin].d.push(r.obs_date); per[r.isin].p.push(r.price!=null?Number(r.price):null); } });
  const computed={}; peers.forEach(p=>{ computed[p.isin]=rolling1y(per[p.isin].d,per[p.isin].p); });
  B14STATE={peers,cmap2,computed,fFund};
  draw();
  function draw(){
    if(!B14STATE) return;
    const selSet=B14STATE.fFund.getSet();
    const chosen=B14STATE.peers.filter(p=> selSet.size===0 || selSet.has(p.name+(p.series?" – "+p.series:"")));
    const allDates=[...new Set([].concat(...chosen.map(p=>B14STATE.computed[p.isin].map(x=>x.d))))].sort();
    const datasets=chosen.map(p=>{ const map={}; B14STATE.computed[p.isin].forEach(x=>map[x.d]=x.ret);
      return {label:p.name,borderColor:B14STATE.cmap2[p.isin],backgroundColor:B14STATE.cmap2[p.isin],
        data:allDates.map(dt=> dt in map? map[dt]:null),spanGaps:true,pointRadius:0,borderWidth:2,tension:.2}; });
    if(charts.b14)charts.b14.destroy();
    if(!datasets.length) return;
    charts.b14=new Chart(el("b14-canvas"),{type:"line",data:{labels:allDates,datasets},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
        scales:{x:{ticks:{maxTicksLimit:9,autoSkip:true}},y:{title:{display:true,text:"1 éves hozam (%)"}}},
        plugins:{legend:{position:"bottom"},datalabels:{display:false},
          tooltip:{mode:"index",intersect:false,yAlign:"bottom",callbacks:{label:c=> c.parsed.y!=null? `${c.dataset.label}: ${c.parsed.y.toFixed(1)}%`:""}}}}});
  }
}

let B15STATE=null;
// 15) Normált árfolyam-index (bázis = 100) — peer group, 3h/6h/1é/3é
async function setupB15(peers,cmap){
  const rs=el("b15-range"); rs.innerHTML=A7_RANGES.map(o=>`<option value="${o.m}">${o.label}</option>`).join("");
  rs.value="12";
  if(charts.b15){charts.b15.destroy();charts.b15=null;}
  el("b15-note").hidden=true;
  const isins=peers.map(p=>p.isin);
  const d=new Date(); d.setFullYear(d.getFullYear()-3); d.setMonth(d.getMonth()-1); const from=d.toISOString().slice(0,10);
  const inlist="("+isins.map(x=>`"${x}"`).join(",")+")";
  let rows=[];
  try{ rows=await sbGetAll(`v_fund_full?isin=in.${inlist}&obs_date=gte.${from}&select=isin,obs_date,price&order=obs_date.asc`); }
  catch(e){ el("b15-note").hidden=false; el("b15-note").textContent="Az árfolyam-adatok nem elérhetők."; return; }
  const per={}; peers.forEach(p=>per[p.isin]={d:[],p:[]});
  rows.forEach(r=>{ if(per[r.isin]){ per[r.isin].d.push(r.obs_date); per[r.isin].p.push(r.price!=null?Number(r.price):null); } });
  B15STATE={peers,cmap,per};
  rs.onchange=draw; draw();
  function draw(){
    if(!B15STATE) return;
    const months=parseInt(rs.value,10);
    const cut=new Date(); cut.setMonth(cut.getMonth()-months); const cutS=cut.toISOString().slice(0,10);
    const allDates=[...new Set([].concat(...B15STATE.peers.map(p=>B15STATE.per[p.isin].d.filter(x=>x>=cutS))))].sort();
    const datasets=B15STATE.peers.map(p=>{
      const dd=B15STATE.per[p.isin].d, pp=B15STATE.per[p.isin].p;
      let base=null; for(let i=0;i<dd.length;i++){ if(dd[i]>=cutS && pp[i]!=null){ base=pp[i]; break; } }
      const map={}; if(base) for(let i=0;i<dd.length;i++){ if(dd[i]>=cutS && pp[i]!=null) map[dd[i]]=pp[i]/base*100; }
      return {label:p.name,borderColor:B15STATE.cmap[p.isin],backgroundColor:B15STATE.cmap[p.isin],
        data:allDates.map(dt=> dt in map? map[dt]:null),spanGaps:true,pointRadius:0,borderWidth:2,tension:.2};
    });
    if(charts.b15)charts.b15.destroy();
    if(!datasets.length) return;
    charts.b15=new Chart(el("b15-canvas"),{type:"line",data:{labels:allDates,datasets},
      options:{responsive:true,maintainAspectRatio:false,
        scales:{x:{ticks:{maxTicksLimit:9,autoSkip:true}},y:{title:{display:true,text:"Index (bázis = 100)"}}},
        plugins:{legend:{position:"bottom"},datalabels:{display:false},
          tooltip:{callbacks:{label:c=> c.parsed.y!=null? `${c.dataset.label}: ${c.parsed.y.toFixed(1)}`:""}}}}});
  }
}

// ===================== összehangolás =====================
function renderActive(){ renderSummary(); (VIEW==="a"?ELEMENTS_A:ELEMENTS_B).forEach(fn=>fn()); }
function switchView(v){
  VIEW=v;
  document.querySelectorAll(".viewswitch button").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
  el("view-a").hidden=(v!=="a"); el("view-b").hidden=(v!=="b");
  renderActive();
}
async function init(){
  try{
    RAW=await sbGetAll("fund_latest?select=isin,name,series,manager,category,currency,risk_return,aum_huf,r_1y,ytd,vol_1y,sharpe_1y,sortino_1y,ter,max_drawdown,decline_days,recovery_days,is_illiquid,obs_date,turnover_cum_30d_huf,peer_group_isin,peer_group_name");
    CATEGORIES=uniq("category"); CURRENCIES=uniq("currency"); RISKS=uniq("risk_return"); MANAGERS=uniq("manager");
    [buildA1,buildA2,buildA3,buildA4,buildA5,buildA6,buildA7,buildA8,buildA9,buildAcat,buildB]
      .forEach(fn=>{ try{ fn(); }catch(e){ console.warn("Csempe kihagyva:", e); } });
    document.querySelectorAll(".viewswitch button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
    const g=el("illiq-global"); g.addEventListener("change",()=>{ window.SHOW_ILLIQUID=g.checked; renderActive(); });
    switchView("a");
  }catch(e){ el("sm-date").textContent="Hiba: "+e.message; }
}
init();
