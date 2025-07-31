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
    const result = await msalInstance.loginPopup({
      scopes: [
        "openid",
        "profile",
        "email",
        "api://315eede8-ee31-4487-b202-81e495e8f9fe/user_impersonation"
      ]
    });

    account = result.account;
    msalInstance.setActiveAccount(account);

    const tokenResponse = await msalInstance.acquireTokenSilent({
      scopes: ["api://315eede8-ee31-4487-b202-81e495e8f9fe/user_impersonation"],
      account
    });

    const token = tokenResponse.accessToken;
    localStorage.setItem("corelord_token", token);
    sessionStorage.setItem("authToken", token);
    sessionStorage.setItem("userEmail", account.username);

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

  msalInstance.setActiveAccount(accounts[0]);

  try {
    const silentResult = await msalInstance.acquireTokenSilent({
      scopes: ["api://315eede8-ee31-4487-b202-81e495e8f9fe/user_impersonation"],
      account: accounts[0]
    });

    const token = silentResult.accessToken;
    localStorage.setItem("corelord_token", token);
    sessionStorage.setItem("authToken", token);
    return token;
  } catch (e) {
    console.warn("🔒 Token silent acquisition failed:", e);
    return null;
  }
}

async function checkProfileAndRedirect() {
  const token = await getToken();
  if (!token) {
    console.warn("⚠️ No token available");
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
      window.location.href = "/profile.html";
    } else if (response.ok) {
      window.location.href = "/dashboard.html";
    } else {
      console.warn("⚠️ Unknown response from /api/profile");
    }
  } catch (err) {
    console.error("❌ Profile check error:", err);
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
