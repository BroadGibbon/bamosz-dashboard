// ===== Supabase REST (csak olvasás) =====
const SB_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + SUPABASE_ANON_KEY,
  "Accept-Profile": "public"
};
async function sbGet(path, extra = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: { ...SB_HEADERS, ...extra } });
  if (!res.ok) throw new Error(res.status + ": " + (await res.text()).slice(0, 200));
  return res;
}
async function sbGetAll(path) {
  let all = [], from = 0, step = 1000;
  const sep = path.includes("?") ? "&" : "?";
  while (true) {
    const res = await sbGet(path + sep + "limit=" + step + "&offset=" + from);
    const chunk = await res.json();
    all = all.concat(chunk);
    if (chunk.length < step) break;
    from += step;
  }
  return all;
}
// ===== formázók =====
const fmt = {
  pct(v,d=1){ return (v==null)?"–":(v*100).toFixed(d)+"%"; },
  num(v,d=2){ return (v==null)?"–":Number(v).toFixed(d); },
  mrd(v){ return (v==null)?"–":(v/1e9).toLocaleString("hu-HU",{maximumFractionDigits:1}); },
  int(v){ return (v==null)?"–":Math.round(v).toLocaleString("hu-HU"); },
  days(v){ return (v==null)?"folyamatban":Math.round(v).toLocaleString("hu-HU")+" nap"; },
  txt(v){ return (v==null||v==="")?"–":v; }
};
function pctClass(v){ if(v==null) return ""; return v<0?"neg":(v>0?"pos":""); }

// ===== kockázati besorolás színe (1 zöld → 7 piros), szám körben =====
const RISK_COLORS = ["#00934C","#4CAF50","#9CCC65","#FDD835","#FB8C00","#F4511E","#D32F2F"];
function riskInfo(v){
  const n=parseInt(v,10);
  if(!(n>=1&&n<=7)) return {bg:"#9e9e9e",fg:"#fff",n:(v==null?"–":v)};
  return {bg:RISK_COLORS[n-1], fg:(n===3||n===4)?"#0D1B1E":"#fff", n};
}
function riskCircle(v){
  const {bg,fg,n}=riskInfo(v);
  return `<span class="risk-c" style="background:${bg};color:${fg}">${n}</span>`;
}

// ===== színpaletta diagramokhoz (zöld családra hangolva + erős kontrasztszínek) =====
const PALETTE = ["#00474F","#2E8B6B","#00E676","#26A69A","#5C6BC0","#AB47BC","#FF7043",
                 "#42A5F5","#EC407A","#8D6E63","#9CCC65","#FFA726","#26C6DA","#7E57C2","#66BB6A",
                 "#EF5350","#78909C","#D4E157","#29B6F6","#FF8A65"];
function colorFor(i){ return PALETTE[i % PALETTE.length]; }

// ===== többszörös választós szűrő (checkbox legördülő); single=true esetén rádió =====
function MultiSelect(label, values, opts={}){
  const {single=false, defaultSel=[], numeric=false, onChange=()=>{}, renderOption=null} = opts;
  const wrap=document.createElement("div"); wrap.className="ms";
  const btn=document.createElement("button"); btn.type="button"; btn.className="ms-btn";
  const panel=document.createElement("div"); panel.className="ms-panel"; panel.hidden=true;
  wrap.append(btn,panel);
  let sel=new Set(defaultSel.map(String));
  const sorted=[...values].sort((a,b)=> numeric?(Number(a)-Number(b)):String(a).localeCompare(String(b),"hu"));
  function updateBtn(){
    if(sel.size===0) btn.innerHTML=`<b>${label}:</b> mind`;
    else if(single) btn.innerHTML=`<b>${label}:</b> ${[...sel][0]}`;
    else btn.innerHTML=`<b>${label}</b> (${sel.size})`;
  }
  function build(){
    panel.innerHTML="";
    if(!single){
      const all=document.createElement("div"); all.className="ms-opt ms-all"; all.textContent="Mind (törlés)";
      all.onclick=()=>{ sel.clear(); build(); updateBtn(); onChange(); };
      panel.append(all);
    }
    sorted.forEach(v=>{
      const opt=document.createElement("label"); opt.className="ms-opt";
      const inp=document.createElement("input");
      inp.type=single?"radio":"checkbox"; inp.name="ms_"+label; inp.value=String(v);
      inp.checked=sel.has(String(v));
      inp.onchange=()=>{
        if(single) sel=new Set([String(v)]);
        else { inp.checked?sel.add(String(v)):sel.delete(String(v)); }
        updateBtn(); onChange();
      };
      const lab=document.createElement("span"); lab.innerHTML=renderOption?renderOption(v):String(v);
      opt.append(inp,lab); panel.append(opt);
    });
  }
  btn.onclick=(e)=>{ e.stopPropagation(); document.querySelectorAll(".ms-panel").forEach(p=>{if(p!==panel)p.hidden=true;}); panel.hidden=!panel.hidden; };
  document.addEventListener("click",(e)=>{ if(!wrap.contains(e.target)) panel.hidden=true; });
  build(); updateBtn();
  return { el:wrap, getSet:()=>new Set(sel) };
}

// ===== szűrés (globális illikvid-kapcsoló + mezőnkénti halmazok) =====
function filterData(base, filters){
  return base.filter(r=>{
    if(!window.SHOW_ILLIQUID && r.is_illiquid) return false;
    for(const key in filters){
      const s=filters[key];
      if(s && s.size>0 && !s.has(String(r[key]))) return false;
    }
    return true;
  });
}
