// ---- Supabase REST közös réteg (csak olvasás) ----
const SB_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + SUPABASE_ANON_KEY,
  "Accept-Profile": "public"
};
async function sbGet(path, extraHeaders = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: { ...SB_HEADERS, ...extraHeaders }
  });
  if (!res.ok) throw new Error(res.status + ": " + (await res.text()).slice(0, 200));
  return res;
}
// Az összes sor lehúzása lapozással (1000-esével)
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
// ---- Formázók ----
const fmt = {
  pct(v, d = 1) { return (v === null || v === undefined) ? "–" : (v * 100).toFixed(d) + "%"; },
  num(v, d = 2) { return (v === null || v === undefined) ? "–" : Number(v).toFixed(d); },
  mrd(v) { return (v === null || v === undefined) ? "–" : (v / 1e9).toLocaleString("hu-HU", {maximumFractionDigits:1}); },
  txt(v) { return (v === null || v === undefined || v === "") ? "–" : v; }
};
function pctClass(v){ if(v===null||v===undefined) return ""; return v<0 ? "neg" : (v>0 ? "pos" : ""); }
function qs(name){ return new URLSearchParams(location.search).get(name); }
