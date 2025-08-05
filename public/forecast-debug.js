const API_BASE_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/forecast";
const API_SCOPE_VALUE = "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation";

const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/forecast-debug.html"
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false }
};
const loginRequest = { scopes: ["openid","profile","email", API_SCOPE_VALUE] };
const msalInstance = new msal.PublicClientApplication(msalConfig);

const out = document.getElementById("out");
const tsTable = document.getElementById("tsTable");
const tsBody  = document.getElementById("tsBody");

function $(id){ return document.getElementById(id); }
function fmt(ts){
  try { return new Date(ts * 1000).toLocaleString(); } catch { return String(ts); }
}

async function acquireToken() {
  await msalInstance.initialize();
  let account = msalInstance.getAllAccounts()[0];
  if (!account) {
    const r = await msalInstance.loginPopup({ scopes: ["openid","profile","email"] });
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

// Show the backend error body instead of only the status code
async function apiGet(path) {
  const token = await acquireToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await res.text();
  if (!res.ok) {
    // Try to extract a JSON message if present
    try {
      const json = JSON.parse(text);
      throw new Error(`GET ${path} ${res.status}: ${json.message || text}`);
    } catch {
      throw new Error(`GET ${path} ${res.status}: ${text}`);
    }
  }
  try { return JSON.parse(text); } catch { return text; }
}

function showRaw(obj) {
  tsTable.style.display = "none";
  out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function showTs(json) {
  const items = json?.items || [];
  tsBody.innerHTML = "";
  items.slice(0, 72).forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmt(r.ts)}</td>
      <td>${r.waveMinM ?? ""} to ${r.waveMaxM ?? ""}</td>
      <td>${r.periodS ?? ""}</td>
      <td>${r.swellDir ?? ""}</td>
      <td>${r.windKt ?? ""}</td>
      <td>${r.windDir ?? ""}</td>
      <td>${r.tideM ?? ""}</td>
    `;
    tsBody.appendChild(tr);
  });
  tsTable.style.display = "table";
  out.textContent = `Rendered ${items.length} rows`;
}

document.addEventListener("DOMContentLoaded", () => {
  $("rawWaveBtn").addEventListener("click", async () => {
    const id = $("breakId").value, h = $("hours").value;
    try { showRaw(await apiGet(`/surfline/raw?type=wave&breakId=${id}&hours=${h}`)); }
    catch (e) { out.textContent = e.toString(); }
  });
  $("rawWindBtn").addEventListener("click", async () => {
    const id = $("breakId").value, h = $("hours").value;
    try { showRaw(await apiGet(`/surfline/raw?type=wind&breakId=${id}&hours=${h}`)); }
    catch (e) { out.textContent = e.toString(); }
  });
  $("rawTideBtn").addEventListener("click", async () => {
    const id = $("breakId").value, h = $("hours").value;
    try { showRaw(await apiGet(`/surfline/raw?type=tides&breakId=${id}&hours=${h}`)); }
    catch (e) { out.textContent = e.toString(); }
  });
  $("tsBtn").addEventListener("click", async () => {
    const id = $("breakId").value, h = $("hours").value;
    try { showTs(await apiGet(`/timeseries?breakId=${id}&hours=${h}`)); }
    catch (e) { out.textContent = e.toString(); }
  });
});
