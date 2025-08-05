const API_BASE_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/forecast";
const API_SCOPE_VALUE = "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation";

const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/forecast-debug.html"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

const loginRequest = {
  scopes: ["openid", "profile", "email", API_SCOPE_VALUE]
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

const out = document.getElementById("out");
const tsTable = document.getElementById("tsTable");
const tsBody = document.getElementById("tsBody");

function $(id) {
  return document.getElementById(id);
}

function fmt(ts) {
  try {
    return new Date(ts * 1000).toLocaleString("en-AU", { timeZone: "Australia/Sydney" });
  } catch {
    return String(ts);
  }
}

function degToCompass(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

async function acquireToken() {
  await msalInstance.initialize();
  let account = msalInstance.getAllAccounts()[0];
  if (!account) {
    const r = await msalInstance.loginPopup({ scopes: ["openid", "profile", "email"] });
    account = r.account;
  }
  try {
    const r = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    return r.accessToken;
  } catch {
    const r = await msalInstance.acquireTokenPopup({ ...loginRequest, account });
    return r.accessToken;
  }
}

async function apiGet(path) {
  const token = await acquireToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await res.text();
  if (!res.ok) {
    try {
      const json = JSON.parse(text);
      throw new Error(`GET ${path} ${res.status}: ${json.message || text}`);
    } catch {
      throw new Error(`GET ${path} ${res.status}: ${text}`);
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function showForecast(json) {
  const items = json?.items || [];
  tsBody.innerHTML = "";

  items.forEach(r => {
    const tr = document.createElement("tr");

    const wave = r.waveHeightM ? `${r.waveHeightM.toFixed(2)} m` : "";
    const swell = r.swellPeriodS && r.swellDir
      ? `${r.swellPeriodS}s @ ${Math.round(r.swellDir)}°`
      : "";
    const wind = r.windSpeedKt && r.windDir
      ? `${degToCompass(r.windDir)} @ ${r.windSpeedKt.toFixed(1)} kt`
      : "";
    const tide = r.tideM ? `${r.tideM.toFixed(2)} m` : "";

    tr.innerHTML = `
      <td>${fmt(r.ts)}</td>
      <td>${wave}</td>
      <td>${swell}</td>
      <td>${wind}</td>
      <td>${tide}</td>
    `;
    tsBody.appendChild(tr);
  });

  tsTable.style.display = "table";
  out.textContent = `Showing ${items.length} forecast entries for ${json.break?.Name || "Break"}`;
}

document.addEventListener("DOMContentLoaded", () => {
  $("forecastBtn").addEventListener("click", async () => {
    const id = $("breakId").value;
    const h = $("hours").value;
    try {
      const data = await apiGet(`/timeseries?breakId=${id}&hours=${h}`);
      showForecast(data);
    } catch (e) {
      out.textContent = e.toString();
    }
  });
});
