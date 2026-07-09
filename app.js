// Közös fejlécek a Supabase REST hívásokhoz (csak olvasás)
const SB_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + SUPABASE_ANON_KEY,
  "Accept-Profile": "public"   // fontos: a 'public' sémát olvassuk
};

// Segédfüggvény: GET a Supabase REST-ből
async function sbGet(path, extraHeaders = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: { ...SB_HEADERS, ...extraHeaders }
  });
  if (!res.ok) throw new Error(res.status + ": " + (await res.text()).slice(0, 200));
  return res;
}

// Élő adatpróba: hány alap van a fund_latest táblában?
async function connectionTest() {
  const el = document.getElementById("status");
  const detail = document.getElementById("detail");
  try {
    // 1 sort kérünk, de a pontos darabszámot a Content-Range fejlécből olvassuk
    const res = await sbGet("fund_latest?select=isin", {
      Prefer: "count=exact",
      "Range-Unit": "items",
      Range: "0-0"
    });
    const range = res.headers.get("content-range") || "/?";
    const total = range.split("/")[1];
    el.textContent = "✅ Adatkapcsolat rendben";
    el.className = "ok";
    detail.textContent = "Alapok száma az adatbázisban: " + total;

    // Ízelítő: top 3 alap 1 éves hozam szerint (csak aktív)
    const top = await (await sbGet(
      "fund_latest?select=name,r_1y&is_illiquid=eq.false&r_1y=not.is.null&order=r_1y.desc&limit=3"
    )).json();
    const ul = document.getElementById("preview");
    ul.innerHTML = "";
    top.forEach(f => {
      const li = document.createElement("li");
      li.textContent = f.name + " — " + (f.r_1y * 100).toFixed(1) + "%";
      ul.appendChild(li);
    });
  } catch (e) {
    el.textContent = "❌ Hiba a kapcsolatban";
    el.className = "err";
    detail.textContent = e.message;
  }
}
connectionTest();
