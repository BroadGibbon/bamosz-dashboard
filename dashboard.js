// ===== állapot =====
let RAW=[];
window.SHOW_ILLIQUID=false;
const ELEMENTS=[];   // elemenkénti render függvények
let CATEGORIES=[], CURRENCIES=[], RISKS=[], MANAGERS=[];

function cmp(x,y,dir){
  if(x==null) return 1; if(y==null) return -1;
  if(typeof x==="string") return x.localeCompare(y,"hu")*dir;
  return (x-y)*dir;
}
const riskOpt = v => `${riskCircle(v)}`;

// ===== ÖSSZEGZŐ =====
function renderSummary(){
  const base=RAW.filter(r=> window.SHOW_ILLIQUID || !r.is_illiquid);
  const aum=base.reduce((s,r)=>s+(r.aum_huf||0),0);
  const date=base.reduce((m,r)=> (r.obs_date&&r.obs_date>m)?r.obs_date:m,"");
  document.getElementById("sm-funds").textContent=base.length.toLocaleString("hu-HU");
  document.getElementById("sm-mgrs").textContent=new Set(base.map(r=>r.manager)).size.toLocaleString("hu-HU");
  document.getElementById("sm-aum").textContent=fmt.mrd(aum);
  document.getElementById("sm-date").textContent=date||"–";
}

// ===== 1) Top 15 Alapkezelő AUM szerint — halmozott vízszintes bar =====
function buildEl1(){
  const box=document.getElementById("el1-filters");
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  box.append(fCat.el,fRisk.el);
  let chart=null;
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk:fRisk.getSet()});
    const byMgr={}; d.forEach(r=>{ if(r.aum_huf!=null){ byMgr[r.manager]=(byMgr[r.manager]||0)+r.aum_huf; } });
    const top=Object.entries(byMgr).sort((a,b)=>b[1]-a[1]).slice(0,15).map(x=>x[0]);
    const cats=[...new Set(d.filter(r=>top.includes(r.manager)&&r.aum_huf!=null).map(r=>r.category))].sort();
    const datasets=cats.map((cat,ci)=>({
      label:cat, backgroundColor:colorFor(ci),
      data: top.map(m=> d.filter(r=>r.manager===m&&r.category===cat&&r.aum_huf!=null).reduce((s,r)=>s+r.aum_huf/1e9,0))
    }));
    if(chart) chart.destroy();
    chart=new Chart(document.getElementById("el1-canvas"),{
      type:"bar", data:{labels:top,datasets},
      options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,
        scales:{x:{stacked:true,title:{display:true,text:"AUM (Mrd Ft)"}},y:{stacked:true}},
        plugins:{legend:{position:"bottom"},
          tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.x.toLocaleString("hu-HU",{maximumFractionDigits:1})} Mrd Ft`}}}}
    });
  }
  ELEMENTS.push(render);
}

// ===== 2) Top 20 Alap — táblázat, választható rangsor, átméretezhető oszlopok =====
const T_COLS=[
 {key:"name",label:"Alap",type:"text",link:true,w:200},
 {key:"manager",label:"Alapkezelő",type:"text",w:150},
 {key:"category",label:"Kategória",type:"text",w:130},
 {key:"risk_return",label:"Kock.",type:"risk",center:true,w:56},
 {key:"currency",label:"Dev.",type:"text",center:true,w:54},
 {key:"aum_huf",label:"AUM (Mrd Ft)",type:"mrd",num:true,w:110},
 {key:"r_1y",label:"1é hozam",type:"pct",num:true,color:true,w:86},
 {key:"ytd",label:"YTD",type:"pct",num:true,color:true,w:76},
 {key:"vol_1y",label:"Volatilitás",type:"pct",num:true,w:94},
 {key:"sharpe_1y",label:"Sharpe",type:"num2",num:true,w:76},
 {key:"sortino_1y",label:"Sortino",type:"num2",num:true,w:78},
 {key:"ter",label:"TER",type:"pct2",num:true,w:70},
 {key:"max_drawdown",label:"Drawdown",type:"pct",num:true,color:true,w:94},
 {key:"recovery_days",label:"DD duration",type:"days",num:true,w:112},
];
const T_RANK=[
 {key:"r_1y",label:"1 éves hozam",dir:-1},
 {key:"aum_huf",label:"AUM",dir:-1},
 {key:"sharpe_1y",label:"Sharpe",dir:-1},
 {key:"sortino_1y",label:"Sortino",dir:-1},
 {key:"ytd",label:"YTD hozam",dir:-1},
 {key:"max_drawdown",label:"Drawdown (legkisebb)",dir:-1},
 {key:"recovery_days",label:"DD duration (legkisebb)",dir:1},
];
function tcell(r,c){
  const v=r[c.key];
  if(c.type==="risk") return riskCircle(v);
  if(c.type==="pct")  return fmt.pct(v,1);
  if(c.type==="pct2") return fmt.pct(v,2);
  if(c.type==="num2") return fmt.num(v,2);
  if(c.type==="mrd")  return fmt.mrd(v);
  if(c.type==="days") return fmt.days(v);
  return fmt.txt(v);
}
function buildEl2(){
  const box=document.getElementById("el2-filters");
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  const fCcy=MultiSelect("Deviza",CURRENCIES,{onChange:render});
  const fMgr=MultiSelect("Alapkezelő",MANAGERS,{onChange:render});
  box.append(fCat.el,fRisk.el,fCcy.el,fMgr.el);
  const rankSel=document.getElementById("el2-rank");
  rankSel.innerHTML=T_RANK.map(o=>`<option value="${o.key}">${o.label}</option>`).join("");
  let sort={key:"r_1y",dir:-1};
  rankSel.value=sort.key;
  rankSel.onchange=()=>{ const o=T_RANK.find(o=>o.key===rankSel.value); sort={key:o.key,dir:o.dir}; render(); };
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk:fRisk.getSet(),currency:fCcy.getSet(),manager:fMgr.getSet()});
    const rows=[...d].sort((a,b)=>cmp(a[sort.key],b[sort.key],sort.dir)).slice(0,20);
    // colgroup
    document.getElementById("el2-cg").innerHTML=T_COLS.map(c=>`<col style="width:${(WIDTHS[c.key]||c.w)}px">`).join("");
    // fejléc
    document.getElementById("el2-h").innerHTML="<tr>"+T_COLS.map(c=>{
      const ar=c.key===sort.key?(sort.dir===1?" ▲":" ▼"):"";
      return `<th data-k="${c.key}" class="${c.num?'r':''}${c.center?' c':''}">${c.label}${ar}<span class="rz"></span></th>`;
    }).join("")+"</tr>";
    // törzs
    document.getElementById("el2-b").innerHTML=rows.map(r=>"<tr>"+T_COLS.map(c=>{
      let inner=tcell(r,c);
      if(c.link) inner=`<a href="fund.html?isin=${encodeURIComponent(r.isin)}" title="${(r.name||'').replace(/"/g,'')}">${inner}</a>`;
      const cls=[c.num?"r":"",c.center?"c":"",c.color?pctClass(r[c.key]):""].join(" ").trim();
      return `<td class="${cls}">${inner}</td>`;
    }).join("")+"</tr>").join("");
    // fejléc-kattintás rendezés
    document.querySelectorAll("#el2-h th").forEach(th=>th.onclick=(e)=>{
      if(e.target.classList.contains("rz")) return;
      const k=th.dataset.k, textCol=["name","manager","category","currency","risk_return"].includes(k);
      if(k===sort.key) sort.dir=-sort.dir; else sort={key:k,dir:textCol?1:-1};
      const o=T_RANK.find(o=>o.key===k); if(o) rankSel.value=k;
      render();
    });
    attachResize("el2",T_COLS);
  }
  ELEMENTS.push(render);
}

// ===== oszlop-átméretezés (közös, Pointer Events) =====
let WIDTHS={}; try{ WIDTHS=JSON.parse(localStorage.getItem("colw")||"{}"); }catch(e){}
function attachResize(prefix,cols){
  const cg=document.getElementById(prefix+"-cg");
  document.querySelectorAll("#"+prefix+"-h th").forEach((th,i)=>{
    const rz=th.querySelector(".rz"); if(!rz) return;
    rz.onpointerdown=e=>{
      e.preventDefault(); e.stopPropagation();
      const sx=e.clientX, col=cg.children[i], sw=col.getBoundingClientRect().width, key=cols[i].key;
      rz.setPointerCapture(e.pointerId);
      const mv=ev=>{ const w=Math.max(44,Math.round(sw+(ev.clientX-sx))); col.style.width=w+"px"; WIDTHS[key]=w; };
      const up=()=>{ rz.releasePointerCapture(e.pointerId); rz.onpointermove=null; rz.onpointerup=null;
        try{localStorage.setItem("colw",JSON.stringify(WIDTHS));}catch(e){} };
      rz.onpointermove=mv; rz.onpointerup=up;
    };
  });
}

// ===== 3) Top 15 Alapkezelő — választható metrika, vízszintes bar =====
const M_RANK=[
 {key:"aum",label:"AUM",axis:"AUM (Mrd Ft)",toBar:v=>v/1e9,fmt:v=>fmt.mrd(v)+" Mrd Ft"},
 {key:"wsharpe",label:"AUM-súlyozott Sharpe",axis:"Sharpe",toBar:v=>v,fmt:v=>fmt.num(v,2)},
 {key:"wter",label:"TER (AUM-súlyozott)",axis:"TER (%)",toBar:v=>v*100,fmt:v=>fmt.pct(v,2)},
];
function aggMgr(d){
  const m={};
  d.forEach(r=>{ (m[r.manager] ||= {aum:0,ssn:0,ssd:0,stn:0,std:0});
    const g=m[r.manager];
    if(r.aum_huf!=null){ g.aum+=r.aum_huf;
      if(r.sharpe_1y!=null){ g.ssn+=r.aum_huf*r.sharpe_1y; g.ssd+=r.aum_huf; }
      if(r.ter!=null){ g.stn+=r.aum_huf*r.ter; g.std+=r.aum_huf; } } });
  return Object.entries(m).map(([manager,g])=>({manager,aum:g.aum,
    wsharpe:g.ssd>0?g.ssn/g.ssd:null, wter:g.std>0?g.stn/g.std:null}));
}
function buildEl3(){
  const box=document.getElementById("el3-filters");
  const fCat=MultiSelect("Kategória",CATEGORIES,{onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  const fCcy=MultiSelect("Deviza",CURRENCIES,{onChange:render});
  box.append(fCat.el,fRisk.el,fCcy.el);
  const sel=document.getElementById("el3-rank");
  sel.innerHTML=M_RANK.map(o=>`<option value="${o.key}">${o.label}</option>`).join("");
  let metric=M_RANK[0]; sel.value=metric.key;
  sel.onchange=()=>{ metric=M_RANK.find(o=>o.key===sel.value); render(); };
  let chart=null;
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk:fRisk.getSet(),currency:fCcy.getSet()});
    const rows=aggMgr(d).filter(x=>x[metric.key]!=null).sort((a,b)=>b[metric.key]-a[metric.key]).slice(0,15);
    if(chart) chart.destroy();
    chart=new Chart(document.getElementById("el3-canvas"),{
      type:"bar",
      data:{labels:rows.map(r=>r.manager),
        datasets:[{label:metric.label,backgroundColor:"#2E8B6B",
          data:rows.map(r=>metric.toBar(r[metric.key]))}]},
      options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,
        scales:{x:{title:{display:true,text:metric.axis}}},
        plugins:{legend:{display:false},
          tooltip:{callbacks:{label:c=>metric.fmt(rows[c.dataIndex][metric.key])}}}}
    });
  }
  ELEMENTS.push(render);
}

// ===== 4) Kockázat–hozam térkép — bubble (x=vol, y=1é hozam, méret=AUM, szín=alapkezelő) =====
function buildEl4(){
  const box=document.getElementById("el4-filters");
  const defCat=CATEGORIES.find(c=>c.toLowerCase().includes("abszol"))||CATEGORIES[0];
  const fCat=MultiSelect("Kategória",CATEGORIES,{single:true,defaultSel:[defCat],onChange:render});
  const fRisk=MultiSelect("Kockázat",RISKS,{numeric:true,onChange:render,renderOption:riskOpt});
  const fCcy=MultiSelect("Deviza",CURRENCIES,{onChange:render});
  box.append(fCat.el,fRisk.el,fCcy.el);
  let chart=null;
  function render(){
    const d=filterData(RAW,{category:fCat.getSet(),risk:fRisk.getSet(),currency:fCcy.getSet()})
      .filter(r=>r.vol_1y!=null&&r.r_1y!=null);
    const aums=d.map(r=>r.aum_huf||0);
    const mn=Math.min(...aums,0), mx=Math.max(...aums,1);
    const rad=a=> d.length<=1?14:6+22*Math.sqrt(((a||0)-mn)/((mx-mn)||1));
    const mgrs=[...new Set(d.map(r=>r.manager))];
    const datasets=mgrs.map((m,i)=>({
      label:m, backgroundColor:colorFor(i)+"cc", borderColor:colorFor(i),
      data:d.filter(r=>r.manager===m).map(r=>({x:r.vol_1y*100,y:r.r_1y*100,r:rad(r.aum_huf),
        name:r.name,aum:r.aum_huf}))
    }));
    if(chart) chart.destroy();
    chart=new Chart(document.getElementById("el4-canvas"),{
      type:"bubble", data:{datasets},
      options:{responsive:true,maintainAspectRatio:false,
        scales:{x:{title:{display:true,text:"Volatilitás (%)"}},
                y:{title:{display:true,text:"1 éves hozam (%)"}}},
        plugins:{legend:{position:"bottom"},
          tooltip:{callbacks:{label:c=>{const p=c.raw;
            return `${p.name}: vol ${p.x.toFixed(1)}%, hozam ${p.y.toFixed(1)}%, AUM ${fmt.mrd(p.aum)} Mrd Ft`;}}}}}
    });
  }
  ELEMENTS.push(render);
}

// ===== összehangolás =====
function renderAll(){ renderSummary(); ELEMENTS.forEach(fn=>fn()); }
async function init(){
  try{
    RAW=await sbGetAll("fund_latest?select=isin,name,series,manager,category,currency,risk_return,aum_huf,r_1y,ytd,vol_1y,sharpe_1y,sortino_1y,ter,max_drawdown,decline_days,recovery_days,is_illiquid,obs_date");
    const uniq=k=>[...new Set(RAW.map(r=>r[k]).filter(v=>v!=null&&v!==""))];
    CATEGORIES=uniq("category"); CURRENCIES=uniq("currency");
    RISKS=uniq("risk_return"); MANAGERS=uniq("manager");
    buildEl1(); buildEl2(); buildEl3(); buildEl4();
    const g=document.getElementById("illiq-global");
    g.addEventListener("change",()=>{ window.SHOW_ILLIQUID=g.checked; renderAll(); });
    renderAll();
  }catch(e){
    document.getElementById("sm-date").textContent="Hiba: "+e.message;
  }
}
init();
