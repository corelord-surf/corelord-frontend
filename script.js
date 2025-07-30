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

async function signIn() {
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
    const token = result.accessToken;

    localStorage.setItem("corelord_token", token);
    sessionStorage.setItem("authToken", token);
    sessionStorage.setItem("userEmail", account.username);

    renderAuthButton(true);
    await checkProfileAndRedirect();
  } catch (err) {
    console.error("❌ Sign-in error:", err);
    alert("Sign-in failed. See console for details.");
  }
}

function logout() {
  msalInstance.logoutPopup().then(() => {
    localStorage.removeItem("corelord_token");
    sessionStorage.clear();
    window.location.href = "/";
  });
}

async function getToken() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: [
        "openid",
        "profile",
        "email",
        "api://315eede8-ee31-4487-b202-81e495e8f9fe/user_impersonation"
      ],
      account: accounts[0]
    });

    const token = result.accessToken;
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
  if (!token) return;

  try {
    const res = await fetch("https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/profile", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 404) {
      window.location.href = "/profile.html";
    } else if (res.ok) {
      window.location.href = "/dashboard.html";
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
  btn.textContent = isSignedIn ? "Logout" : "Sign In";
  btn.classList.add(isSignedIn ? "bg-red-600" : "bg-blue-600");
  btn.onclick = isSignedIn ? logout : signIn;

  container.appendChild(btn);
}

window.addEventListener("DOMContentLoaded", async () => {
  const accounts = msalInstance.getAllAccounts();

  if (accounts.length > 0) {
    account = accounts[0];
    renderAuthButton(true);
    if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
      await checkProfileAndRedirect();
    }
  } else {
    renderAuthButton(false);
  }
});
