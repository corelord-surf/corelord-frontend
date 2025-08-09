// Surf Planner with availability filtering

// API bases
const BACKEND_BASE = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";
const PLANNER_API_BASE = `${BACKEND_BASE}/api/planner`;
const API_SCOPE_VALUE = "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation";

// MSAL setup to read availability
const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/planner.html"
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false }
};
const loginRequest = { scopes: ["openid","profile","email", API_SCOPE_VALUE] };
const msalInstance = new msal.PublicClientApplication(msalConfig);

// DOM
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

// Preferences
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
  } catch { return null; }
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

// Availability fetch from backend
async function acquireTokenOptional() {
  try {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) return null;
    try {
      const r = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
      return r.accessToken;
    } catch {
      const r = await msalInstance.acquireTokenPopup({ ...loginRequest, account: accounts[0] });
      return r.accessToken;
    }
  } catch {
    return null;
  }
}

async function apiGet(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`${url} failed ${res.status}`);
  return res.json();
}

// Returns an array of blocks like { dow: 0..6, startHour: 6, durationHours: 2 }
async function loadAvailabilityFromApi() {
  const token = await acquireTokenOptional();
  if (!token) return null;
  try {
    const items = await apiGet(`${PLANNER_API_BASE}/availability`, token);
    // API returns Dow and StartHour from your existing page
    return Array.isArray(items) ? items.map(x => ({
      dow: Number(x.Dow ?? x.dow),
      startHour: Number(x.StartHour ?? x.startHour),
      durationHours: Number(x.DurationHours ?? 2)
    })) : null;
  } catch (e) {
    console.warn("Availability API not available. Planning without availability.", e);
    return null;
  }
}

// Filters a unix second ts against availability blocks in local time
function isInAvailability(ts, blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return true; // no blocks means do not restrict
  const d = new Date(ts * 1000);
  const dow = d.getDay();            // 0..6
  const hour = d.getHours();         // 0..23
  for (const b of blocks) {
    if (b.dow !== dow) continue;
    const dur = Number.isFinite(b.durationHours) && b.durationHours > 0 ? b.durationHours : 2;
    if (hour >= b.startHour && hour < b.startHour + dur) return true;
  }
  return false;
}

// Optional time of day preference
function isInPreferredTime(ts, timeOfDay) {
  if (timeOfDay === "any") return true;
  const d = new Date(ts * 1000);
  const hour = d.getHours();
  if (timeOfDay === "morning") return hour >= 5 && hour < 12;
  if (timeOfDay === "afternoon") return hour >= 12 && hour < 17;
  if (timeOfDay === "evening") return hour >= 17 && hour < 21;
  return true;
}

// Data access for forecast
async function fetchJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}
async function getBreaks() {
  return fetchJson(`${BACKEND_BASE}/api/forecast/breaks`);
}
async function getForecast(breakId) {
  return fetchJson(`${BACKEND_BASE}/api/forecast/${breakId}`);
}

// Scoring
function scorePoint(prefs, item) {
  let waveScore = 0;
  if (item.waveHeightM != null) {
    const { minWave, maxWave } = prefs;
    if (item.waveHeightM >= minWave && item.waveHeightM <= maxWave) {
      const centre = (minWave + maxWave) / 2;
      const span = Math.max(maxWave - minWave, 0.01);
      const dist = Math.abs(item.waveHeightM - centre);
      waveScore = 1 - Math.min(dist / (span / 2), 1);
    } else {
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
    const w = item.windSpeedKt;
    if (w <= prefs.maxWind) {
      let s = 1 - (w / Math.max(prefs.maxWind, 0.1)) * 0.4;
      windScore = Math.max(0.6, s);
    } else {
      const over = w - prefs.maxWind;
      windScore = Math.max(0, 0.6 - over * 0.05);
    }
  }

  const score = (waveScore + periodScore + windScore) / 3;
  return Math.round(score * 100) / 100;
}

// Render
function renderRows(rows) {
  els.resultsBody.innerHTML = "";
  for (const r of rows) {
    const when = new Date(r.ts * 1000).toLocaleString();
    const tr = document.createElement("tr");
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
  setStatus("Loading availability and breaks");
  const prefs = savePrefs();

  // read availability from backend, optional
  const availabilityBlocks = await loadAvailabilityFromApi();

  const breaks = await getBreaks();

  const regionSet = new Set(prefs.regions?.length ? prefs.regions : breaks.map(b => b.region));
  const targetBreaks = breaks.filter(b => regionSet.has(b.region));

  const now = Math.floor(Date.now() / 1000);
  const horizon = now + Number(prefs.days) * 24 * 3600;

  setStatus(`Evaluating ${targetBreaks.length} breaks`);
  const allRows = [];

  for (const b of targetBreaks) {
    try {
      const fc = await getForecast(b.id);
      const items = Array.isArray(fc.items) ? fc.items : [];
      for (const i of items) {
        if (i.ts <
