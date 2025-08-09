// Planner Setup reads and writes preferences via the API
// Now sources Country → Region → Break from /api/forecast/breaks

const API_BASE_URL = (window.API_BASE ||
  "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/planner");
const FORECAST_BASE = (window.FORECAST_BASE ||
  "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/forecast");
const API_SCOPE_VALUE = (window.API_SCOPE ||
  "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation");

const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/planner-setup.html"
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false }
};
const loginRequest = { scopes: ["openid", "profile", "email", API_SCOPE_VALUE] };
const msalInstance = new msal.PublicClientApplication(msalConfig);

const DIRS = ["N","NE","E","SE","S","SW","W","NW"];

// Elements
const countrySel = document.getElementById("country");
const regionSel  = document.getElementById("region");
const breakSel   = document.getElementById("break");
const swellDirsDiv = document.getElementById("swellDirs");
const windDirsDiv  = document.getElementById("windDirs");
const statusEl = document.getElementById("status");

// Form fields
const f = {
  minHeight: document.getElementById("minHeight"),
  maxHeight: document.getElementById("maxHeight"),
  minPeriod: document.getElementById("minPeriod"),
  maxPeriod: document.getElementById("maxPeriod"),
  maxWind: document.getElementById("maxWind"),
  minTide: document.getElementById("minTide"),
  maxTide: document.getElementById("maxTide"),
};

// Helpers
function log(...a){ console.log("[planner-setup]", ...a); }
function warn(...a){ console.warn("[planner-setup]", ...a); }

function renderDirChecks(container) {
  container.innerHTML = "";
  DIRS.forEach(d => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "0.4rem";
    const input = document.createElement("input");
    input.type = "checkbox"; input.value = d;
    label.appendChild(input);
    label.appendChild(document.createTextNode(d));
    container.appendChild(label);
  });
}
function getChecked(container) {
  return Array.from(container.querySelectorAll("input[type=checkbox]"))
    .filter(i => i.checked).map(i => i.value);
}
function setChecked(container, values) {
  const set = new Set(values || []);
  container.querySelectorAll("input[type=checkbox]").forEach(i => { i.checked = set.has(i.value); });
}

async function acquireApiToken(account) {
  try {
    const r = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    return r.accessToken;
  } catch (e) {
    warn("Silent token failed, using popup", e);
    const r = await msalInstance.acquireTokenPopup({ ...loginRequest, account });
    return r.accessToken;
  }
}

async function apiGet(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} failed ${res.status}`);
  return res.json();
}
async function apiPost(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${url} failed ${res.status}`);
  return res.json();
}

// Breaks cache + cascading filters
let allBreaks = [];

async function loadAllBreaks() {
  const list = await apiGet(`${FORECAST_BASE}/breaks`, null);
  allBreaks = (list || []).map(b => ({
    id: b.id ?? b.Id,
    name: b.name ?? b.Name,
    region: b.region ?? b.Region ?? "",
    country: b.country ?? b.Country ?? "",
  }));
}

function fillSelect(sel, values, allLabel) {
  if (!sel) return;
  sel.innerHTML = "";
  if (allLabel) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = allLabel;
    sel.appendChild(o);
  }
  values.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v || "(Unknown)";
    sel.appendChild(o);
  });
  if (sel.options.length > 1) sel.value = sel.options[1].value;
}

function populateCountries() {
  const countries = Array.from(new Set(allBreaks.map(b => b.country || "Unknown"))).sort();
  fillSelect(countrySel, countries, "(All countries)");
}

function populateRegions() {
  const c = countrySel.value || "";
  const regs = Array.from(new Set(allBreaks
                    .filter(b => !c || b.country === c)
                    .map(b => b.region || ""))).sort();
  fillSelect(regionSel, regs, "(All regions)");
}

function populateBreaks() {
  const c = countrySel.value || "";
  const r = regionSel.value || "";
  const list = allBreaks
    .filter(b => (!c || b.country === c) && (!r || b.region === r))
    .sort((a,b) => a.name.localeCompare(b.name));

  breakSel.innerHTML = "";
  list.forEach(b => {
    const o = document.createElement("option");
    o.value = String(b.id);
    o.textContent = `${b.name}`;
    breakSel.appendChild(o);
  });
  if (!breakSel.value && breakSel.options.length) {
    breakSel.value = breakSel.options[0].value;
  }
}

function readForm() {
  return {
    breakId: parseInt(breakSel.value, 10),
    minHeight: f.minHeight.value ? parseFloat(f.minHeight.value) : null,
    maxHeight: f.maxHeight.value ? parseFloat(f.maxHeight.value) : null,
    minPeriod: f.minPeriod.value ? parseFloat(f.minPeriod.value) : null,
    maxPeriod: f.maxPeriod.value ? parseFloat(f.maxPeriod.value) : null,
    swellDirs: getChecked(swellDirsDiv),
    maxWind: f.maxWind.value ? parseInt(f.maxWind.value, 10) : null,
    windDirs: getChecked(windDirsDiv),
    minTide: f.minTide.value ? parseFloat(f.minTide.value) : null,
    maxTide: f.maxTide.value ? parseFloat(f.maxTide.value) : null
  };
}
function writeForm(p) {
  f.minHeight.value = p?.MinHeightM ?? "";
  f.maxHeight.value = p?.MaxHeightM ?? "";
  f.minPeriod.value = p?.MinPeriodS ?? "";
  f.maxPeriod.value = p?.MaxPeriodS ?? "";
  setChecked(swellDirsDiv, p?.AllowedSwellDirs ? p.AllowedSwellDirs.split(",") : []);
  f.maxWind.value = p?.MaxWindKt ?? "";
  setChecked(windDirsDiv, p?.AllowedWindDirs ? p.AllowedWindDirs.split(",") : []);
  f.minTide.value = p?.MinTideM ?? "";
  f.maxTide.value = p?.MaxTideM ?? "";
}

// Boot with deep link support
document.addEventListener("DOMContentLoaded", async () => {
  try {
    log("Boot start.");
    renderDirChecks(swellDirsDiv);
    renderDirChecks(windDirsDiv);

    await msalInstance.initialize();
    let account = msalInstance.getAllAccounts()[0];
    if (!account) {
      const r = await msalInstance.loginPopup({ scopes: ["openid","profile","email"] });
      account = r.account;
    }
    const token = await acquireApiToken(account);

    // Load breaks and setup cascading selects
    await loadAllBreaks();
    populateCountries();
    populateRegions();
    populateBreaks();

    // Deep link via query params
    const params = new URLSearchParams(location.search);
    const qRegion = params.get("region");
    const qBreakId = params.get("breakId");
    const qCountry = params.get("country");

    if (qCountry && Array.from(countrySel.options).some(o => o.value === qCountry)) {
      countrySel.value = qCountry; populateRegions(); populateBreaks();
    }
    if (qRegion && Array.from(regionSel.options).some(o => o.value === qRegion)) {
      regionSel.value = qRegion; populateBreaks();
    }
    if (qBreakId && Array.from(breakSel.options).some(o => o.value === String(qBreakId))) {
      breakSel.value = String(qBreakId);
    }

    // Load existing prefs for selected break
    const existing = await apiGet(`${API_BASE_URL}/prefs?breakId=${breakSel.value}`, token);
    writeForm(existing);
    statusEl.textContent = existing ? "Loaded existing preferences" : "No preferences saved yet";

    // Events
    countrySel.addEventListener("change", async () => {
      populateRegions(); populateBreaks();
      const ex = await apiGet(`${API_BASE_URL}/prefs?breakId=${breakSel.value}`, token);
      writeForm(ex);
      statusEl.textContent = ex ? "Loaded existing preferences" : "No preferences saved yet";
    });

    regionSel.addEventListener("change", async () => {
      populateBreaks();
      const ex = await apiGet(`${API_BASE_URL}/prefs?breakId=${breakSel.value}`, token);
      writeForm(ex);
      statusEl.textContent = ex ? "Loaded existing preferences" : "No preferences saved yet";
    });

    breakSel.addEventListener("change", async () => {
      const ex = await apiGet(`${API_BASE_URL}/prefs?breakId=${breakSel.value}`, token);
      writeForm(ex);
      statusEl.textContent = ex ? "Loaded existing preferences" : "No preferences saved yet";
    });

    document.getElementById("saveBtn").addEventListener("click", async () => {
      try {
        const body = readForm();
        if (body.minHeight != null && body.maxHeight != null && body.minHeight > body.maxHeight) {
          statusEl.textContent = "Min height must be less than max height";
          return;
        }
        if (body.minPeriod != null && body.maxPeriod != null && body.minPeriod > body.maxPeriod) {
          statusEl.textContent = "Min period must be less than max period";
          return;
        }
        if (body.minTide != null && body.maxTide != null && body.minTide > body.maxTide) {
          statusEl.textContent = "Min tide must be less than max tide";
          return;
        }
        await apiPost(`${API_BASE_URL}/prefs`, token, body);
        statusEl.textContent = "Saved";
      } catch (e) {
        console.error(e);
        statusEl.textContent = "Save failed";
      }
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
      writeForm(null);
      statusEl.textContent = "Cleared. Save to persist";
    });
  } catch (e) {
    console.error("[planner-setup] boot failed", e);
    statusEl.textContent = "Failed to initialise. See console.";
  }
});
