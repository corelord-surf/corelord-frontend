// ==== MSAL CONFIG ====
const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/dashboard.html"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "email",
    "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation"
  ]
};

const PROFILE_API =
  "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/profile";

const msalInstance = new msal.PublicClientApplication(msalConfig);

// ==== DOM HELPERS ====
function $(id) { return document.getElementById(id); }
function setText(id, value) { $(id).textContent = value ?? "N/A"; }
function show(id, visible) { $(id).style.display = visible ? "block" : "none"; }
function hide(id) { show(id, false); }

// ==== PROFILE FETCH ====
async function getProfile(accessToken) {
  const resp = await fetch(PROFILE_API, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (resp.status === 404) {
    const tokenEmail = msalInstance.getAllAccounts()[0]?.username || "N/A";
    setText("name", "N/A");
    setText("email", tokenEmail);
    setText("phone", "N/A");
    setText("country", "N/A");
    show("profile", true);
    return;
  }

  if (!resp.ok) {
    throw new Error(`GET /api/profile failed: ${resp.status}`);
  }

  const data = await resp.json();
  const tokenEmail = msalInstance.getAllAccounts()[0]?.username || null;

  const name = data?.name ?? null;
  const email = data?.email ?? tokenEmail ?? "N/A";
  const phone = data?.phone ?? null;
  const country = data?.country ?? null;

  setText("name", name || "N/A");
  setText("email", email || "N/A");
  setText("phone", phone || "N/A");
  setText("country", country || "N/A");

  show("profile", true);
}

// ==== TOKEN ACQUISITION + LOAD ====
async function acquireTokenAndLoadProfile() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    window.location.href = "index.html";
    return;
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0]
    });
    hide("errorMessage");
    hide("loadingMessage");
    await getProfile(result.accessToken);
  } catch (silentErr) {
    console.warn("Silent token failed. Trying popup.", silentErr);
    try {
      const result = await msalInstance.acquireTokenPopup(loginRequest);
      hide("errorMessage");
      hide("loadingMessage");
      await getProfile(result.accessToken);
    } catch (popupErr) {
      console.error("Token acquisition failed:", popupErr);
      hide("loadingMessage");
      show("errorMessage", true);
    }
  }
}

// ==== SIGN OUT ====
function signOut() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.logout({ account: accounts[0] });
  }
}
window.signOut = signOut;

// ==== FORECAST WIRING ====
// Public endpoints. No bearer needed for read.
const BACKEND_BASE = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";

const els = {
  breakSelect: $("breakSelect"),
  loadForecastBtn: $("loadForecastBtn"),
  forecastTableBody: $("forecastTableBody"),
  status: $("status"),
};

function setStatus(msg) { if (els.status) els.status.textContent = msg || ""; }

async function fetchJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

async function loadBreaks() {
  setStatus("Loading breaks");
  const data = await fetchJson(`${BACKEND_BASE}/api/forecast/breaks`);
  if (!Array.isArray(data)) {
    throw new Error("Unexpected breaks payload");
  }
  els.breakSelect.innerHTML = "";
  for (const b of data) {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = `${b.region} • ${b.name}`;
    els.breakSelect.appendChild(opt);
  }
  setStatus("");
}

function formatHourFromUnix(tsSeconds) {
  const d = new Date(tsSeconds * 1000);
  return d.toLocaleString();
}

function renderForecast(rows) {
  els.forecastTableBody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatHourFromUnix(r.ts)}</td>
      <td>${Number(r.waveHeightM ?? 0).toFixed(2)}</td>
      <td>${Number(r.swellPeriodS ?? 0).toFixed(1)}</td>
      <td>${Number(r.windSpeedKt ?? 0).toFixed(1)}</td>
      <td>${r.swellDir ?? ""}</td>
    `;
    els.forecastTableBody.appendChild(tr);
  }
}

async function loadForecastForSelectedBreak() {
  const breakId = els.breakSelect.value;
  if (!breakId) return;
  setStatus(`Loading forecast for break ${breakId}`);
  const data = await fetchJson(`${BACKEND_BASE}/api/forecast/${breakId}`);
  const items = Array.isArray(data.items) ? data.items : [];
  const now = Math.floor(Date.now() / 1000);
  const next24 = items.filter(i => i.ts >= now).slice(0, 24);
  renderForecast(next24.length ? next24 : items.slice(0, 24));
  setStatus("");
}

// ==== BOOT ====
window.addEventListener("DOMContentLoaded", () => {
  // initial UI state
  show("loadingMessage", true);
  show("profile", false);
  show("errorMessage", false);

  // profile first
  acquireTokenAndLoadProfile();

  // forecast selectors and first render
  loadBreaks()
    .then(() => {
      if (els.loadForecastBtn) {
        els.loadForecastBtn.addEventListener("click", loadForecastForSelectedBreak);
      }
      if (els.breakSelect && els.breakSelect.value) {
        return loadForecastForSelectedBreak();
      }
    })
    .catch(err => {
      console.error(err);
      setStatus(err.message);
    });
});
