// List the user's saved break preferences. Allows filter, edit, delete.

const API_BASE_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/planner";
const API_SCOPE_VALUE = "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation";

const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/preferences.html"
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false }
};
const loginRequest = { scopes: ["openid", "profile", "email", API_SCOPE_VALUE] };
const msalInstance = new msal.PublicClientApplication(msalConfig);

// Elements
const regionSel = document.getElementById("region");
const refreshBtn = document.getElementById("refreshBtn");
const tbody = document.getElementById("prefsBody");

async function acquireToken(account) {
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
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`${url} failed ${res.status}`);
  return res.json();
}
async function apiDelete(url, token) {
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 204) throw new Error(`${url} failed ${res.status}`);
}

function fmtRange(min, max) {
  const a = min == null ? "" : String(min);
  const b = max == null ? "" : String(max);
  if (!a && !b) return "N/A";
  if (!a) return `<= ${b}`;
  if (!b) return `>= ${a}`;
  return `${a} to ${b}`;
}

function renderRows(items, token) {
  tbody.innerHTML = "";
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">No preferences saved yet</td></tr>`;
    return;
  }

  for (const p of items) {
    const tr = document.createElement("tr");

    const editUrl = `/planner-setup.html?region=${encodeURIComponent(p.Region)}&breakId=${encodeURIComponent(p.BreakId)}`;

    tr.innerHTML = `
      <td>${p.Region} • ${p.BreakName}</td>
      <td>${fmtRange(p.MinHeightM, p.MaxHeightM)}</td>
      <td>${fmtRange(p.MinPeriodS, p.MaxPeriodS)}</td>
      <td>${p.AllowedSwellDirs || "N/A"}</td>
      <td>${p.MaxWindKt ?? "N/A"} kt • ${p.AllowedWindDirs || "N/A"}</td>
      <td>${fmtRange(p.MinTideM, p.MaxTideM)}</td>
      <td class="muted">Coming soon</td>
      <td>
        <a class="btn btn-secondary" href="${editUrl}">Edit</a>
        <button class="btn btn-danger" data-break="${p.BreakId}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("button[data-break]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete preferences for this break")) return;
      const id = btn.getAttribute("data-break");
      await apiDelete(`${API_BASE_URL}/prefs?breakId=${id}`, token);
      load(token); // refresh
    });
  });
}

async function load(token) {
  const region = regionSel.value;
  const url = region
    ? `${API_BASE_URL}/prefs/list?region=${encodeURIComponent(region)}`
    : `${API_BASE_URL}/prefs/list`;
  const items = await apiGet(url, token);
  renderRows(items, token);
}

document.addEventListener("DOMContentLoaded", async () => {
  await msalInstance.initialize();
  let account = msalInstance.getAllAccounts()[0];
  if (!account) {
    const r = await msalInstance.loginPopup({ scopes: ["openid", "profile", "email"] });
    account = r.account;
  }
  const token = await acquireToken(account);

  await load(token);
  regionSel.addEventListener("change", () => load(token));
  refreshBtn.addEventListener("click", () => load(token));
});
