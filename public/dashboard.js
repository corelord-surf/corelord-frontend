// ==== CONSTANTS ====
const FRONTEND_URL = "https://calm-coast-025fe8203.2.azurestaticapps.net";
const API_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/profile";

// ==== MSAL CONFIG ====
const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: `${FRONTEND_URL}/dashboard.html`
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false }
};

const loginRequest = {
  scopes: ["openid", "profile", "email", "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation"]
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// ==== DOM HELPERS ====
function $(id) { return document.getElementById(id); }
function setText(id, value) { $(id).textContent = value ?? "N/A"; }
function show(id, visible) { $(id).style.display = visible ? "block" : "none"; }
function hide(id) { show(id, false); }

// ==== TOKEN ====
async function getToken() {
  const account = msalInstance.getAllAccounts()[0];
  if (!account) return null;
  try {
    const r = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    return r.accessToken;
  } catch {
    const r = await msalInstance.acquireTokenPopup(loginRequest);
    return r.accessToken;
  }
}

// ==== PROFILE FETCH ====
async function getProfile(accessToken) {
  const resp = await fetch(API_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (resp.status === 404) {
    // No profile yet -> send user to profile creation
    window.location.href = "/profile.html";
    return;
  }

  if (!resp.ok) {
    throw new Error(`GET /api/profile failed: ${resp.status}`);
  }

  const data = await resp.json();
  console.log("Profile response:", data);

  const tokenEmail = msalInstance.getAllAccounts()[0]?.username || null;
  const name    = data?.name ?? null;
  const email   = data?.email ?? tokenEmail ?? "N/A";
  const phone   = data?.phone ?? null;
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
    const token = await getToken();
    hide("errorMessage");
    hide("loadingMessage");
    await getProfile(token);
  } catch (err) {
    console.error("Token/profile load failed:", err);
    hide("loadingMessage");
    show("errorMessage", true);
  }
}

// ==== SIGN OUT ====
function signOut() {
  const account = msalInstance.getAllAccounts()[0];
  if (account) msalInstance.logout({ account });
}

// ==== BOOT ====
window.addEventListener("DOMContentLoaded", () => {
  show("loadingMessage", true);
  show("profile", false);
  show("errorMessage", false);
  acquireTokenAndLoadProfile();
});

window.signOut = signOut;
