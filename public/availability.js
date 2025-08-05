// Simple weekly grid in two hour blocks, 6..20 local

const API_BASE_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/planner";
const API_SCOPE_VALUE = "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation";

const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/availability.html"
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false }
};
const loginRequest = { scopes: ["openid","profile","email", API_SCOPE_VALUE] };
const msalInstance = new msal.PublicClientApplication(msalConfig);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const START = 6;   // earliest hour shown
const END   = 20;  // last start hour shown, represents [END, END+2)

const gridEl = document.getElementById("grid");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");

// state: Set of key "dow@start"
const selected = new Set();

function hfmt(h) { const ampm = h < 12 ? "am" : "pm"; const hr = ((h + 11) % 12) + 1; return `${hr}${ampm}`; }

function renderGrid() {
  gridEl.innerHTML = "";
  // top row headers
  gridEl.appendChild(headCell("")); // empty corner
  for (let d = 0; d < 7; d++) gridEl.appendChild(headCell(DAYS[d]));

  for (let h = START; h <= END; h += 2) {
    // time label
    const label = document.createElement("div");
    label.className = "rowlabel";
    label.textContent = `${hfmt(h)} to ${hfmt(h+2)}`;
    gridEl.appendChild(label);

    for (let d = 0; d < 7; d++) {
      const key = `${d}@${h}`;
      const cell = document.createElement("div");
      cell.className = "cell" + (selected.has(key) ? " on" : "");
      cell.dataset.key = key;
      cell.textContent = " ";
      cell.addEventListener("click", () => {
        if (selected.has(key)) {
          selected.delete(key);
          cell.classList.remove("on");
        } else {
          selected.add(key);
          cell.classList.add("on");
        }
      });
      gridEl.appendChild(cell);
    }
  }
}

function headCell(text) {
  const d = document.createElement("div");
  d.className = "dayhead";
  d.textContent = text;
  return d;
}

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
async function apiPost(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${url} failed ${res.status}`);
  return res.json();
}

function toPayload() {
  const arr = [];
  for (const key of selected) {
    const [d, h] = key.split("@").map(n => parseInt(n, 10));
    arr.push({ dow: d, startHour: h });
  }
  return arr;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await msalInstance.initialize();
    let account = msalInstance.getAllAccounts()[0];
    if (!account) {
      const r = await msalInstance.loginPopup({ scopes: ["openid","profile","email"] });
      account = r.account;
    }
    const token = await acquireToken(account);

    // load existing
    const items = await apiGet(`${API_BASE_URL}/availability`, token);
    items.forEach(it => selected.add(`${it.Dow}@${it.StartHour}`));
    renderGrid();
    statusEl.textContent = items.length ? "Loaded saved availability" : "No availability saved yet";

    saveBtn.addEventListener("click", async () => {
      try {
        await apiPost(`${API_BASE_URL}/availability`, token, toPayload());
        statusEl.textContent = "Saved";
      } catch (e) {
        console.error(e);
        statusEl.textContent = "Save failed";
      }
    });

    clearBtn.addEventListener("click", () => {
      selected.clear();
      renderGrid();
      statusEl.textContent = "Cleared. Save to persist";
    });
  } catch (e) {
    console.error("availability boot failed", e);
    statusEl.textContent = "Failed to initialise";
  }
});
