// Planner Setup – reads and writes preferences via the API

const API_BASE = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/planner";
const API_SCOPE = "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation";

const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/planner-setup.html"
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false }
};
const loginRequest = { scopes: ["openid","profile","email", API_SCOPE] };
const msalInstance = new msal.PublicClientApplication(msalConfig);

const DIRS = ["N","NE","E","SE","S","SW","W","NW"];

// elements
const regionSel = document.getElementById("region");
const breakSel = document.getElementById("break");
const swellDirsDiv = document.getElementById("swellDirs");
const windDirsDiv = document.getElementById("windDirs");
const statusEl = document.getElementById("status");

// form fields
const f = {
  minHeight: document.getElementById("minHeight"),
  maxHeight: document.getElementById("maxHeight"),
  minPeriod: document.getElementById("minPeriod"),
  maxPeriod: document.getElementById("maxPeriod"),
  maxWind: document.getElementById("maxWind"),
  minTide: document.getElementById("minTide"),
  maxTide: document.getElementById("maxTide"),
};

// utils
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
  } catch {
    const r = await msalInstance.acquireTokenPopup({ ...loginRequest, account });
    return r.accessToken;
  }
}

async function apiGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 204) return null;      // no prefs yet
  if (res.status === 404) return null;      // legacy behaviour if any
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

async function loadRegions(token) {
  const regs = await apiGet(`${API_BASE}/regions`, token);
  regionSel.innerHTML = "";
  regs.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.name;
    opt.textContent = r.name;
    regionSel.appendChild(opt);
  });
}

async function loadBreaks(token) {
  const region = regionSel.value;
  const list = await apiGet(`${API_BASE}/breaks?region=${encodeURIComponent(region)}`, token);
  breakSel.innerHTML = "";
  list.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.Id;
    opt.textContent = b.Name;
    breakSel.appendChild(opt);
  });
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

(async function init() {
  renderDirChecks(swellDirsDiv);
  renderDirChecks(windDirsDiv);

  await msalInstance.initialize();
  let account = msalInstance.getAllAccounts()[0];
  if (!account) {
    const r = await msalInstance.loginPopup({ scopes: ["openid","profile","email"] });
    account = r.account;
  }
  const token = await acquireApiToken(account);

  await loadRegions(token);
  await loadBreaks(token);

  try {
    const existing = await apiGet(`${API_BASE}/prefs?breakId=${breakSel.value}`, token);
    writeForm(existing);
    statusEl.textContent = existing ? "Loaded existing preferences" : "No preferences saved yet";
  } catch (e) {
    console.warn(e);
    statusEl.textContent = "Could not load preferences";
  }

  regionSel.addEventListener("change", async () => {
    await loadBreaks(token);
    const existing = await apiGet(`${API_BASE}/prefs?breakId=${breakSel.value}`, token);
    writeForm(existing);
    statusEl.textContent = existing ? "Loaded existing preferences" : "No preferences saved yet";
  });

  breakSel.addEventListener("change", async () => {
    const existing = await apiGet(`${API_BASE}/prefs?breakId=${breakSel.value}`, token);
    writeForm(existing);
    statusEl.textContent = existing ? "Loaded existing preferences" : "No preferences saved yet";
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
      await apiPost(`${API_BASE}/prefs`, token, body);
      statusEl.textContent = "Saved";
    } catch (e) {
      console.error(e);
      statusEl.textContent = "Save failed";
    }
  });

  document.getElementById("resetBtn").addEventListener("click", async () => {
    writeForm(null);
    statusEl.textContent = "Cleared. Save to persist";
  });
})();
