const msalConfig = {
  auth: {
    clientId: "825d8657-c509-42b6-9107-dd5e39268723",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://agreeable-ground-04732bc03.1.azurestaticapps.net"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

const scopes = ["api://315eede8-ee31-4487-b202-81e495e8f9fe/user_impersonation"];
const msalInstance = new msal.PublicClientApplication(msalConfig);
let account;
let signInInProgress = false;

async function signIn() {
  if (signInInProgress) {
    console.warn("🔄 Sign-in already in progress...");
    return;
  }

  signInInProgress = true;

  try {
    const loginResponse = await msalInstance.loginPopup({
      scopes: ["openid", "profile", "email", ...scopes]
    });

    account = loginResponse.account;
    msalInstance.setActiveAccount(account);

    const tokenResponse = await msalInstance.acquireTokenSilent({
      scopes,
      account
    });

    const token = tokenResponse.accessToken;
    storeTokenData(token, account.username);
    renderAuthButton(true);
    await checkProfileAndRedirect();
  } catch (err) {
    console.error("❌ Sign-in error:", err);
    alert("Sign-in failed. See console for details.");
  } finally {
    signInInProgress = false;
  }
}

function logout() {
  msalInstance.logoutPopup().then(() => {
    msalInstance.clearCache();
    localStorage.removeItem("corelord_token");
    sessionStorage.clear();
    window.location.href = "/";
  });
}

async function getToken() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;

  const activeAccount = accounts[0];
  msalInstance.setActiveAccount(activeAccount);

  try {
    const silentResult = await msalInstance.acquireTokenSilent({
      scopes,
      account: activeAccount
    });

    const token = silentResult.accessToken;
    storeTokenData(token, activeAccount.username);
    return token;
  } catch (err) {
    if (err instanceof msal.InteractionRequiredAuthError) {
      console.warn("🔒 Silent token failed, falling back to popup...");
      try {
        const popupResult = await msalInstance.acquireTokenPopup({ scopes });
        const token = popupResult.accessToken;
        storeTokenData(token, activeAccount.username);
        return token;
      } catch (popupErr) {
        console.error("❌ Token popup acquisition failed:", popupErr);
        return null;
      }
    } else {
      console.error("❌ Token silent acquisition error:", err);
      return null;
    }
  }
}

function storeTokenData(token, email) {
  localStorage.setItem("corelord_token", token);
  sessionStorage.setItem("authToken", token);
  sessionStorage.setItem("userEmail", email);
}

async function checkProfileAndRedirect() {
  const token = await getToken();
  if (!token) {
    console.warn("⚠️ No token available. User likely not signed in.");
    return;
  }

  try {
    const response = await fetch("https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/profile", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.status === 404) {
      console.info("🔍 No profile found. Redirecting to profile setup...");
      window.location.href = "/profile.html";
    } else if (response.ok) {
      console.info("✅ Profile found. Redirecting to dashboard...");
      window.location.href = "/dashboard.html";
    } else {
      console.warn(`⚠️ Unexpected response from /api/profile: ${response.status}`);
    }
  } catch (err) {
    console.error("❌ Error checking profile:", err);
  }
}

function renderAuthButton(isSignedIn) {
  const container = document.getElementById("auth-buttons");
  container.innerHTML = "";

  const btn = document.createElement("button");
  btn.className = "px-4 py-2 rounded text-white";

  if (isSignedIn) {
    btn.textContent = "Logout";
    btn.classList.add("bg-red-600");
    btn.onclick = logout;
  } else {
    btn.textContent = "Sign In";
    btn.classList.add("bg-blue-600");
    btn.onclick = signIn;
  }

  container.appendChild(btn);
}

window.addEventListener("DOMContentLoaded", async () => {
  const accounts = msalInstance.getAllAccounts();

  if (accounts.length > 0) {
    account = accounts[0];
    msalInstance.setActiveAccount(account);
    renderAuthButton(true);

    if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
      await checkProfileAndRedirect();
    }
  } else {
    renderAuthButton(false);
  }
});
