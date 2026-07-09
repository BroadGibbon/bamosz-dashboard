// A fő "piac" táblázat: rendezés + keresés, kliensoldalon.
const COLS = [
  { key:"name",        label:"Alap",           type:"text", link:true },
  { key:"manager",     label:"Alapkezelő",     type:"text" },
  { key:"category",    label:"Kategória",      type:"text" },
  { key:"currency",    label:"Dev.",           type:"text", center:true },
  { key:"aum_huf",     label:"AUM (Mrd Ft)",   type:"mrd",  num:true },
  { key:"r_1y",        label:"1é hozam",       type:"pct",  num:true, color:true },
  { key:"ytd",         label:"YTD",            type:"pct",  num:true, color:true },
  { key:"vol_1y",      label:"Volatilitás",    type:"pct",  num:true },
  { key:"sharpe_1y",   label:"Sharpe",         type:"num2", num:true },
  { key:"ter",         label:"TER",            type:"pct2", num:true },
];
let RAW = [], VIEW = [];
let sortKey = "aum_huf", sortDir = -1;

function cellText(row, c){
  const v = row[c.key];
  if (c.type==="pct")  return fmt.pct(v,1);
  if (c.type==="pct2") return fmt.pct(v,2);
  if (c.type==="num2") return fmt.num(v,2);
  if (c.type==="mrd")  return fmt.mrd(v);
  return fmt.txt(v);
}
function applyView(){
  const q = (document.getElementById("search").value || "").toLowerCase().trim();
  const showIlliquid = document.getElementById("illiq").checked;
  VIEW = RAW.filter(r => {
    if (!showIlliquid && r.is_illiquid) return false;
    if (q && !((r.name||"").toLowerCase().includes(q) || (r.manager||"").toLowerCase().includes(q))) return false;
    return true;
  });
  VIEW.sort((a,b)=>{
    let x=a[sortKey], y=b[sortKey];
    if (x===null||x===undefined) return 1;
    if (y===null||y===undefined) return -1;
    if (typeof x==="string") return x.localeCompare(y,"hu")*sortDir;
    return (x-y)*sortDir;
  });
  render();
}
function render(){
  const thead = document.getElementById("thead");
  thead.innerHTML = "<tr>" + COLS.map(c=>{
    const arrow = c.key===sortKey ? (sortDir===1?" ▲":" ▼") : "";
    return `<th data-k="${c.key}" class="${c.num?'r':''}">${c.label}${arrow}</th>`;
  }).join("") + "</tr>";
  thead.querySelectorAll("th").forEach(th=>th.onclick=()=>{
    const k=th.dataset.k;
    if (k===sortKey) sortDir=-sortDir; else { sortKey=k; sortDir = (k==="name"||k==="manager"||k==="category"||k==="currency")?1:-1; }
    applyView();
  });
  const tb = document.getElementById("tbody");
  tb.innerHTML = VIEW.map(r=>"<tr>"+COLS.map(c=>{
    let inner = cellText(r,c);
    if (c.link) inner = `<a href="fund.html?isin=${encodeURIComponent(r.isin)}">${inner}</a>`;
    const cls = [c.num?"r":"", c.center?"c":"", c.color?pctClass(r[c.key]):""].join(" ").trim();
    return `<td class="${cls}">${inner}</td>`;
  }).join("")+"</tr>").join("");
  // összegzősáv
  const totAum = VIEW.reduce((s,r)=>s+(r.aum_huf||0),0);
  document.getElementById("summary").textContent =
    `${VIEW.length} alap megjelenítve • összes AUM: ${fmt.mrd(totAum)} Mrd Ft`;
}
async function init(){
  try{
    RAW = await sbGetAll("fund_latest?select=isin,name,series,manager,category,currency,aum_huf,r_1y,ytd,vol_1y,sharpe_1y,ter,is_illiquid");
    document.getElementById("search").addEventListener("input", applyView);
    document.getElementById("illiq").addEventListener("change", applyView);
    applyView();
  }catch(e){
    document.getElementById("summary").textContent = "Hiba: " + e.message;
  }
}
init();
