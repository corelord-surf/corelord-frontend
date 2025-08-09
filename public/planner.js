// Base config
const BACKEND_BASE = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";

const els = {
  prefMinWave: document.getElementById("prefMinWave"),
  prefMaxWave: document.getElementById("prefMaxWave"),
  prefMinPeriod: document.getElementById("prefMinPeriod"),
  prefMaxWind: document.getElementById("prefMaxWind"),
  prefRegions: document.getElementById("prefRegions"),
  prefDays: document.getElementById("prefDays"),
  prefTimeOfDay: document.getElementById("prefTimeOfDay"),
  savePrefsBtn: document.getElementById("savePrefsBtn"),
  planBtn: document.getElementById("planBtn"),
  resultsBody: document.getElementById("resultsBody"),
  status: document.getElementById("status"),
};

function setStatus(text) { els.status.textContent = text || ""; }

function savePrefs() {
  const regions = Array.from(els.prefRegions.selectedOptions).map(o => o.value);
  const prefs = {
    minWave: Number(els.prefMinWave.value || 0),
    maxWave: Number(els.prefMaxWave.value || 99),
    minPeriod: Number(els.prefMinPeriod.value || 0),
    maxWind: Number(els.prefMaxWind.value || 99),
    regions,
    days: Number(els.prefDays.value || 5),
    timeOfDay: els.prefTimeOfDay.value || "any",
  };
  localStorage.setItem("corelord.prefs", JSON.stringify(prefs));
  return prefs;
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem("corelord.prefs");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applyPrefsToForm(p) {
  if (!p) return;
  els.prefMinWave.value = p.minWave;
  els.prefMaxWave.value = p.maxWave;
  els.prefMinPeriod.value = p.minPeriod;
  els.prefMaxWind.value = p.maxWind;
  els.prefDays.value = String(p.days);
  els.prefTimeOfDay.value = p.timeOfDay || "any";
  for (const opt of els.prefRegions.options) {
    opt.selected = p.regions?.includes(opt.value) || false;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

// Load all breaks
async function getBreaks() {
  return fetchJson(`${BACKEND_BASE}/api/forecast/breaks`);
}

// Load cached forecast for a given break
async function getForecast(breakId) {
  return fetchJson(`${BACKEND_BASE}/api/forecast/${breakId}`);
}

// Time window filter
function isInPreferredTime(ts, timeOfDay) {
  if (timeOfDay === "any") return true;
  const d = new Date(ts * 1000);
  const hour = d.getHours();
  if (timeOfDay === "morning") return hour >= 5 && hour < 12;
  if (timeOfDay === "afternoon") return hour >= 12 && hour < 17;
  if (timeOfDay === "evening") return hour >= 17 && hour < 21;
  return true;
}

// Scoring function
function scorePoint(prefs, item) {
  // Each component is 0 to 1. Weighted equally for now.
  let waveScore = 0;
  if (item.waveHeightM != null) {
    const { minWave, maxWave } = prefs;
    if (item.waveHeightM >= minWave && item.waveHeightM <= maxWave) {
      // Closer to centre of band is better
      const centre = (minWave + maxWave) / 2;
      const span = Math.max(maxWave - minWave, 0.01);
      const dist = Math.abs(item.waveHeightM - centre);
      waveScore = 1 - Math.min(dist / (span / 2), 1);
    } else {
      // Soft penalty if a bit outside band
      const over = item.waveHeightM > maxWave ? item.waveHeightM - maxWave : minWave - item.waveHeightM;
      waveScore = Math.max(0, 1 - over);
    }
  }

  let periodScore = 0;
  if (item.swellPeriodS != null) {
    periodScore = Math.max(0, Math.min(1, (item.swellPeriodS - prefs.minPeriod) / 4));
  }

  let windScore = 0;
  if (item.windSpeedKt != null) {
    // Lower wind is better. At or below maxWind scores 1. Above drops quickly.
    const w = item.windSpeedKt;
    if (w <= prefs.maxWind) {
      windScore = 1 - (w / Math.max(prefs.maxWind, 0.1)) * 0.4; // mild reduction inside band
      windScore = Math.max(0.6, windScore); // still decent if inside band
    } else {
      const over = w - prefs.maxWind;
      windScore = Math.max(0, 0.6 - over * 0.05);
    }
  }

  // Simple average
  const score = (waveScore + periodScore + windScore) / 3;
  return Math.round(score * 100) / 100;
}

// Render table
function renderRows(rows) {
  els.resultsBody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    const when = new Date(r.ts * 1000).toLocaleString();
    tr.innerHTML = `
      <td>${when}</td>
      <td>${r.breakName}</td>
      <td>${r.region}</td>
      <td>${r.waveHeightM?.toFixed(2) ?? ""}</td>
      <td>${r.swellPeriodS?.toFixed(1) ?? ""}</td>
      <td>${r.windSpeedKt?.toFixed(1) ?? ""}</td>
      <td><span class="pill">${r.score}</span></td>
    `;
    els.resultsBody.appendChild(tr);
  }
}

// Main plan
async function plan() {
  setStatus("Loading breaks");
  const prefs = savePrefs();
  const breaks = await getBreaks();

  // Filter by region selection
  const regionSet = new Set(prefs.regions?.length ? prefs.regions : breaks.map(b => b.region));
  const targetBreaks = breaks.filter(b => regionSet.has(b.region));

  const now = Math.floor(Date.now() / 1000);
  const horizon = now + Number(prefs.days) * 24 * 3600;

  setStatus(`Evaluating ${targetBreaks.length} breaks`);
  const allRows = [];

  // Fetch forecasts in sequence to keep it simple for now
  for (const b of targetBreaks) {
    try {
      const fc = await getForecast(b.id);
      const items = Array.isArray(fc.items) ? fc.items : [];
      for (const i of items) {
        if (i.ts < now || i.ts > horizon) continue;
        if (!isInPreferredTime(i.ts, prefs.timeOfDay)) continue;

        const score = scorePoint(prefs, i);
        allRows.push({
          ts: i.ts,
          breakId: b.id,
          breakName: b.name,
          region: b.region,
          waveHeightM: i.waveHeightM ?? null,
          swellPeriodS: i.swellPeriodS ?? null,
          windSpeedKt: i.windSpeedKt ?? null,
          score,
        });
      }
    } catch (e) {
      console.warn(`Failed forecast for ${b.name}`, e);
    }
  }

  // Sort by score then earliest
  allRows.sort((a, b) => b.score - a.score || a.ts - b.ts);

  // Top 40 for now
  renderRows(allRows.slice(0, 40));
  setStatus(`Found ${allRows.length} matching hours. Showing top 40.`);
}

// Wire up
els.savePrefsBtn.addEventListener("click", () => {
  savePrefs();
  setStatus("Saved");
  setTimeout(() => setStatus(""), 800);
});
els.planBtn.addEventListener("click", () => {
  plan().catch(err => { console.error(err); setStatus(err.message); });
});

// First load
(function init() {
  // Seed default regions selection
  const stored = loadPrefs();
  if (stored?.regions?.length) {
    applyPrefsToForm(stored);
  } else {
    // Select both by default
    for (const opt of els.prefRegions.options) opt.selected = true;
  }
})();
