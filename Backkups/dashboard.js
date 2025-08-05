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

const API_URL =
  "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/profile";

const msalInstance = new msal.PublicClientApplication(msalConfig);

// ==== DOM HELPERS ====
function $(id) { return document.getElementById(id); }
function setText(id, value) { $(id).textContent = value ?? "N/A"; }
function show(id, visible) { $(id).style.display = visible ? "block" : "none"; }
function hide(id) { show(id, false); }

// ==== PROFILE FETCH ====
async function getProfile(accessToken) {
  const resp = await fetch(API_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  // No profile created yet
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
  console.log("Profile response:", data);

  // API uses: name, email, country, phone
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
    // Not signed in
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
    console.warn("Silent token failed; trying popup…", silentErr);
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

// ==== BOOT ====
window.addEventListener("DOMContentLoaded", () => {
  // initial UI state
  show("loadingMessage", true);
  show("profile", false);
  show("errorMessage", false);

  acquireTokenAndLoadProfile();
});

// expose for the Sign Out button
window.signOut = signOut;
