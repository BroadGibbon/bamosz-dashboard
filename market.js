// ===== Két nézet: Top 20 alap + Top 20 alapkezelő =====
const TOPN = 20;
const FUND_COLS = [
  { key:"name",        label:"Alap",         type:"text", link:true, w:200 },
  { key:"manager",     label:"Alapkezelő",   type:"text", w:150 },
  { key:"category",    label:"Kategória",    type:"text", w:130 },
  { key:"currency",    label:"Dev.",         type:"text", center:true, w:56 },
  { key:"risk_return", label:"Kock.",        type:"text", center:true, w:56 },
  { key:"aum_huf",     label:"AUM (Mrd Ft)", type:"mrd",  num:true, w:110 },
  { key:"r_1y",        label:"1é hozam",     type:"pct",  num:true, color:true, w:88 },
  { key:"ytd",         label:"YTD",          type:"pct",  num:true, color:true, w:78 },
  { key:"vol_1y",      label:"Volatilitás",  type:"pct",  num:true, w:96 },
  { key:"sharpe_1y",   label:"Sharpe",       type:"num2", num:true, w:78 },
  { key:"ter",         label:"TER",          type:"pct2", num:true, w:74 },
];
const MGR_COLS = [
  { key:"manager",  label:"Alapkezelő",          type:"text", w:230 },
  { key:"n",        label:"Alapok",              type:"int",  num:true, w:74 },
  { key:"aum_huf",  label:"Összes AUM (Mrd Ft)", type:"mrd",  num:true, w:160 },
  { key:"w_r1y",    label:"AUM-súly. 1é hozam",  type:"pct",  num:true, color:true, w:150 },
  { key:"w_sharpe", label:"AUM-súly. Sharpe",    type:"num2", num:true, w:140 },
];
const RANK = [
  { key:"r_1y",      label:"1 éves hozam", dir:-1 },
  { key:"aum_huf",   label:"AUM",          dir:-1 },
  { key:"sharpe_1y", label:"Sharpe",       dir:-1 },
  { key:"ytd",       label:"YTD",          dir:-1 },
  { key:"vol_1y",    label:"Volatilitás",  dir:-1 },
  { key:"ter",       label:"TER (legolcsóbb elöl)", dir:1 },
];
const FILTERS = [
  { id:"f-category", key:"category", num:false },
  { id:"f-currency", key:"currency", num:false },
  { id:"f-risk",     key:"risk_return", num:true },
  { id:"f-manager",  key:"manager", num:false },
];
let RAW=[], SET=[];
let fSort={key:"r_1y",dir:-1};
let mSort={key:"aum_huf",dir:-1};
let WIDTHS={};
try { WIDTHS = JSON.parse(localStorage.getItem("colw")||"{}"); } catch(e){}

function saveWidths(){ try{ localStorage.setItem("colw", JSON.stringify(WIDTHS)); }catch(e){} }
function cellFmt(v,c){
  if (c.type==="pct")  return fmt.pct(v,1);
  if (c.type==="pct2") return fmt.pct(v,2);
  if (c.type==="num2") return fmt.num(v,2);
  if (c.type==="mrd")  return fmt.mrd(v);
  if (c.type==="int")  return fmt.int(v);
  return fmt.txt(v);
}
function cmp(x,y,dir){
  if(x===null||x===undefined) return 1;
  if(y===null||y===undefined) return -1;
  if(typeof x==="string") return x.localeCompare(y,"hu")*dir;
  return (x-y)*dir;
}

// ---- szűrt halmaz ----
function computeSet(){
  const q=(document.getElementById("search").value||"").toLowerCase().trim();
  const showIll=document.getElementById("illiq").checked;
  const fv={}; FILTERS.forEach(f=>fv[f.key]=document.getElementById(f.id).value);
  SET = RAW.filter(r=>{
    if(!showIll && r.is_illiquid) return false;
    for(const f of FILTERS){ if(fv[f.key]!=="" && String(r[f.key])!==fv[f.key]) return false; }
    if(q && !((r.name||"").toLowerCase().includes(q)||(r.manager||"").toLowerCase().includes(q))) return false;
    return true;
  });
}
// ---- alapkezelői aggregáció ----
function aggManagers(set){
  const m={};
  set.forEach(r=>{
    const k=r.manager||"–";
    (m[k] ||= {manager:k,n:0,aum:0,wrn:0,wrd:0,wsn:0,wsd:0});
    const g=m[k]; g.n++;
    if(r.aum_huf!=null){ g.aum+=r.aum_huf;
      if(r.r_1y!=null){ g.wrn+=r.aum_huf*r.r_1y; g.wrd+=r.aum_huf; }
      if(r.sharpe_1y!=null){ g.wsn+=r.aum_huf*r.sharpe_1y; g.wsd+=r.aum_huf; }
    }
  });
  return Object.values(m).map(g=>({
    manager:g.manager, n:g.n, aum_huf:g.aum,
    w_r1y: g.wrd>0? g.wrn/g.wrd : null,
    w_sharpe: g.wsd>0? g.wsn/g.wsd : null
  }));
}

// ---- általános rács-renderelő (colgroup + fejléc + törzs + oszlop-átméretezés) ----
function renderGrid(prefix, cols, rows, sortState){
  const cg=document.getElementById(prefix+"-cg");
  cg.innerHTML = cols.map(c=>`<col style="width:${(WIDTHS[c.key]||c.w)}px">`).join("");
  const h=document.getElementById(prefix+"-h");
  h.innerHTML = "<tr>"+cols.map(c=>{
    const ar = c.key===sortState.key ? (sortState.dir===1?" ▲":" ▼") : "";
    return `<th data-k="${c.key}" class="${c.num?'r':''}">${c.label}${ar}<span class="rz"></span></th>`;
  }).join("")+"</tr>";
  const b=document.getElementById(prefix+"-b");
  b.innerHTML = rows.map(r=>"<tr>"+cols.map(c=>{
    let inner=cellFmt(r[c.key],c);
    let title="";
    if(c.link){ inner=`<a href="fund.html?isin=${encodeURIComponent(r.isin)}">${inner}</a>`; title=` title="${(r[c.key]||"").replace(/"/g,'')}"`; }
    const cls=[c.num?"r":"", c.center?"c":"", c.color?pctClass(r[c.key]):""].join(" ").trim();
    return `<td class="${cls}"${title}>${inner}</td>`;
  }).join("")+"</tr>").join("");
  // fejléc-kattintás = rendezés
  h.querySelectorAll("th").forEach(th=>{
    th.addEventListener("click", ev=>{
      if(ev.target.classList.contains("rz")) return;
      const k=th.dataset.k;
      const textCol=["name","manager","category","currency","risk_return"].includes(k);
      if(k===sortState.key) sortState.dir=-sortState.dir; else { sortState.key=k; sortState.dir=textCol?1:-1; }
      if(prefix==="funds"){ const opt=RANK.find(o=>o.key===k); if(opt) document.getElementById("rank").value=k; }
      renderAll();
    });
  });
  attachResize(prefix, cols);
}
// oszlop-átméretezés (egér + érintés, Pointer Events)
function attachResize(prefix, cols){
  const cg=document.getElementById(prefix+"-cg");
  const ths=document.querySelectorAll("#"+prefix+"-h th");
  ths.forEach((th,i)=>{
    const rz=th.querySelector(".rz"); if(!rz) return;
    rz.addEventListener("pointerdown", e=>{
      e.preventDefault(); e.stopPropagation();
      const startX=e.clientX;
      const col=cg.children[i];
      const startW=col.getBoundingClientRect().width;
      const key=cols[i].key;
      rz.setPointerCapture(e.pointerId);
      const move=ev=>{
        const w=Math.max(44, Math.round(startW+(ev.clientX-startX)));
        col.style.width=w+"px"; WIDTHS[key]=w;
      };
      const up=ev=>{
        rz.releasePointerCapture(e.pointerId);
        rz.removeEventListener("pointermove",move); rz.removeEventListener("pointerup",up);
        saveWidths();
      };
      rz.addEventListener("pointermove",move); rz.addEventListener("pointerup",up);
    });
  });
}

function renderAll(){
  computeSet();
  // Top 20 alap
  const funds=[...SET].sort((a,b)=>cmp(a[fSort.key],b[fSort.key],fSort.dir)).slice(0,TOPN);
  renderGrid("funds", FUND_COLS, funds, fSort);
  // Top 20 alapkezelő
  const mgrs=aggManagers(SET).sort((a,b)=>cmp(a[mSort.key],b[mSort.key],mSort.dir)).slice(0,TOPN);
  renderGrid("mgrs", MGR_COLS, mgrs, mSort);
  // összegzés
  const totAum=SET.reduce((s,r)=>s+(r.aum_huf||0),0);
  document.getElementById("summary").textContent =
    `${SET.length} alap • ${aggManagers(SET).length} alapkezelő • összes AUM: ${fmt.mrd(totAum)} Mrd Ft`;
}
function populateFilters(){
  FILTERS.forEach(f=>{
    const vals=[...new Set(RAW.map(r=>r[f.key]).filter(v=>v!==null&&v!==undefined&&v!==""))];
    vals.sort((a,b)=> f.num?(Number(a)-Number(b)):String(a).localeCompare(String(b),"hu"));
    const sel=document.getElementById(f.id);
    sel.innerHTML=`<option value="">Mind</option>`+vals.map(v=>`<option>${v}</option>`).join("");
    sel.addEventListener("change", renderAll);
  });
  const rank=document.getElementById("rank");
  rank.innerHTML=RANK.map(o=>`<option value="${o.key}">${o.label}</option>`).join("");
  rank.value=fSort.key;
  rank.addEventListener("change", ()=>{
    const o=RANK.find(o=>o.key===rank.value); fSort={key:o.key,dir:o.dir}; renderAll();
  });
}
function resetFilters(){
  document.getElementById("search").value="";
  FILTERS.forEach(f=>document.getElementById(f.id).value="");
  document.getElementById("illiq").checked=false;
  renderAll();
}
async function init(){
  try{
    RAW=await sbGetAll("fund_latest?select=isin,name,series,manager,category,currency,risk_return,aum_huf,r_1y,ytd,vol_1y,sharpe_1y,ter,is_illiquid");
    populateFilters();
    document.getElementById("search").addEventListener("input", renderAll);
    document.getElementById("illiq").addEventListener("change", renderAll);
    document.getElementById("reset").addEventListener("click", resetFilters);
    renderAll();
  }catch(e){
    document.getElementById("summary").textContent="Hiba: "+e.message;
  }
}
init();
