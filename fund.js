Chart.register(ChartDataLabels);
Chart.defaults.set("plugins.datalabels",{display:false});
Chart.defaults.font.family='Calibri,"Segoe UI",sans-serif';
const el=id=>document.getElementById(id);
const ISIN=new URLSearchParams(location.search).get("isin");

const F_FIELDS=[
 ["series","Sorozat","txt"],["isin","ISIN","txt"],["manager","Alapkezelő","txt"],
 ["category","Kategória","txt"],["risk_return","Kockázati besorolás","risk"],["currency","Deviza","txt"],
 ["launch_date","Indulás","txt"],["legal_type","Jogi típus","txt"],["geo_exposure","Földrajzi kitettség","txt"],
 ["esg","ESG","txt"],["aum_huf","AUM (Mrd Ft)","mrd"],["r_1y","1 éves hozam","pct"],
 ["ytd","YTD hozam","pct"],["vol_1y","Volatilitás","pct"],["sharpe_1y","Sharpe","num2"],
 ["sortino_1y","Sortino","num2"],["ter","TER","pct2"],["max_drawdown","Max. drawdown","pct"],
 ["recovery_days","DD duration","days"],["peer_group_name","Peer group","txt"],
 ["status","Állapot","txt"],["obs_date","Adatok dátuma","txt"],
];
function val(f,key,type){ const v=f[key];
  switch(type){ case "risk":return riskCircle(v); case "pct":return fmt.pct(v,1); case "pct2":return fmt.pct(v,2);
    case "num2":return fmt.num(v,2); case "mrd":return fmt.mrd(v); case "days":return fmt.days(v); default:return fmt.txt(v);} }

const F_METRICS=[
 {key:"nav",label:"AUM (nettó eszközérték)",axis:v=>"AUM"},
 {key:"price",label:"Árfolyam",axis:()=>"Árfolyam"},
 {key:"turnover",label:"Napi forgalom",axis:()=>"Napi forgalom"},
];

async function main(){
  if(!ISIN){ el("f-title").textContent="Hiányzó ISIN"; return; }
  let lat=[],dim=[];
  try{
    [lat,dim]=await Promise.all([
      sbGetAll(`fund_latest?isin=eq.${ISIN}&select=*`),
      sbGetAll(`fund_dim?isin=eq.${ISIN}&select=*`),
    ]);
  }catch(e){ el("f-title").textContent="Hiba az adatok lekérésekor"; el("f-sub").textContent=e.message; return; }
  const f={...(dim[0]||{}),...(lat[0]||{})};
  if(!f.name){ el("f-title").textContent="Nem található alap ehhez az ISIN-hez"; return; }
  document.title=f.name+" – összefoglaló";
  el("f-title").textContent=f.name;
  el("f-sub").innerHTML=(f.series?`Sorozat: <b>${f.series}</b> · `:"")+`ISIN: ${f.isin}`;
  // Alap adatai
  el("f-data").innerHTML=F_FIELDS.filter(([k])=>f[k]!=null&&f[k]!=="").map(([k,l,t])=>
    `<div class="kvi"><div class="k">${l}</div><div class="v">${val(f,k,t)}</div></div>`).join("");

  buildSeries(f);
  buildPeers(f);
}

async function buildSeries(f){
  const sel=el("f-metric");
  sel.innerHTML=F_METRICS.map(m=>`<option value="${m.key}">${m.label}</option>`).join("");
  const d=new Date(); d.setFullYear(d.getFullYear()-3); const from=d.toISOString().slice(0,10);
  let rows=[];
  try{ rows=await sbGetAll(`v_fund_full?isin=eq.${ISIN}&obs_date=gte.${from}&select=obs_date,price,nav,turnover&order=obs_date.asc`); }
  catch(e){ return; }
  const dates=rows.map(r=>r.obs_date);
  let chart=null;
  function draw(){
    const m=F_METRICS.find(x=>x.key===sel.value);
    const data=rows.map(r=> r[m.key]!=null?Number(r[m.key]):null);
    if(chart)chart.destroy();
    chart=new Chart(el("f-series"),{type:"line",
      data:{labels:dates,datasets:[{label:m.label,data,borderColor:"#2E8B6B",backgroundColor:"rgba(46,139,107,.12)",
        fill:m.key!=="turnover",pointRadius:0,borderWidth:2,tension:.2}]},
      options:{responsive:true,maintainAspectRatio:false,
        scales:{x:{ticks:{maxTicksLimit:9,autoSkip:true}},y:{title:{display:true,text:m.axis(f.currency)}}},
        plugins:{legend:{display:false},datalabels:{display:false},
          tooltip:{callbacks:{label:c=> c.parsed.y!=null? c.parsed.y.toLocaleString("hu-HU",{maximumFractionDigits:2}):""}}}}});
  }
  sel.onchange=draw; draw();
}

async function buildPeers(f){
  const note=el("f-peernote");
  let peers=[];
  try{
    const q=`fund_latest?category=eq.${encodeURIComponent(f.category)}&currency=eq.${encodeURIComponent(f.currency)}&risk_return=eq.${encodeURIComponent(f.risk_return)}&select=isin,name,series,vol_1y,r_1y,sharpe_1y,ter,aum_huf`;
    peers=await sbGetAll(q);
  }catch(e){ note.hidden=false; note.textContent="A társalapok lekérése nem sikerült."; return; }
  buildGauges(f, peers);
  peers=peers.filter(r=>r.vol_1y!=null&&r.r_1y!=null);
  if(!peers.length){ note.hidden=false; note.textContent="Nincs elég adat a társalapokhoz."; return; }
  const aums=peers.map(r=>r.aum_huf||0),mn=Math.min(...aums,0),mx=Math.max(...aums,1);
  const rad=a=> peers.length<=1?18:8+24*Math.sqrt(((a||0)-mn)/((mx-mn)||1));
  const others=peers.filter(r=>r.isin!==f.isin);
  const self=peers.filter(r=>r.isin===f.isin);
  const pt=r=>({x:r.vol_1y*100,y:r.r_1y*100,r:rad(r.aum_huf),name:r.name,series:r.series,aum:r.aum_huf});
  const datasets=[
    {label:"Társalapok",backgroundColor:"rgba(46,139,107,.55)",borderColor:"#2E8B6B",data:others.map(pt)},
    {label:"Jelen alap",backgroundColor:"#00E676",borderColor:"#0D1B1E",borderWidth:2,data:self.map(pt)},
  ];
  new Chart(el("f-peers"),{type:"bubble",data:{datasets},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{x:{title:{display:true,text:"Volatilitás (%)"}},y:{title:{display:true,text:"1 éves hozam (%)"}}},
      plugins:{legend:{position:"bottom"},datalabels:{display:false},
        tooltip:{callbacks:{label:c=>{const p=c.raw;return `${p.name}${p.series?" ("+p.series+")":""}: vol ${p.x.toFixed(1)}%, hozam ${p.y.toFixed(1)}%, AUM ${fmt.mrd(p.aum)} Mrd`;}}}}}});
}


function buildGauges(f, group){
  const box=el("f-gauges"); if(!box) return;
  const metrics=[
    {key:"r_1y",label:"1 éves hozam",fmt:v=>fmt.pct(v,1),better:"high"},
    {key:"sharpe_1y",label:"Sharpe",fmt:v=>fmt.num(v,2),better:"high"},
    {key:"ter",label:"TER",fmt:v=>fmt.pct(v,2),better:"low"},
  ];
  box.innerHTML=metrics.map(m=>{
    const vals=group.map(p=>p[m.key]).filter(v=>v!=null);
    if(vals.length<1 || f[m.key]==null)
      return `<div class="gauge-row"><div class="gauge-lab">${m.label}</div><div class="gauge-na">nincs elég adat</div></div>`;
    const min=Math.min(...vals), max=Math.max(...vals), span=(max-min)||1;
    let wn=0,wd=0; group.forEach(p=>{ if(p[m.key]!=null&&p.aum_huf!=null){ wn+=p[m.key]*p.aum_huf; wd+=p.aum_huf; } });
    const avg=wd>0?wn/wd:null;
    const pos=v=>Math.max(0,Math.min(100,(v-min)/span*100));
    const grad=m.better==="high"
      ? "linear-gradient(90deg,#c62828 0%,#e0a800 50%,#2E8B6B 100%)"
      : "linear-gradient(90deg,#2E8B6B 0%,#e0a800 50%,#c62828 100%)";
    const fp=pos(f[m.key]); const ap=avg!=null?pos(avg):null;
    return `<div class="gauge-row">
      <div class="gauge-lab">${m.label}</div>
      <div class="gauge-track">
        <div class="gauge-bar" style="background:${grad}"></div>
        ${ap!=null?`<div class="gauge-avg" style="left:${ap}%"></div>`:""}
        <div class="gauge-fund" style="left:${fp}%"></div>
      </div>
      <div class="gauge-ends"><span>min: ${m.fmt(min)}</span><span>max: ${m.fmt(max)}</span></div>
      <div class="gauge-vals"><span class="g-fund">● Alap: <b>${m.fmt(f[m.key])}</b></span>${avg!=null?`<span class="g-avg">▏ Csoport átlag: <b>${m.fmt(avg)}</b></span>`:""}</div>
    </div>`;
  }).join("");
}

main();
