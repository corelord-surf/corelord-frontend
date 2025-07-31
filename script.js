// script.js

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


const tokenRequest = {
  scopes: [
    "openid",
    "profile",
    "email",
    "api://YOUR_API_APP_CLIENT_ID/access_as_user"
  ]
};

const msalInstance = new msal.PublicClientApplication(msalConfig);
let account = null;

// Called on each page that includes this script
window.addEventListener("DOMContentLoaded", async () => {
  account = msalInstance.getAllAccounts()[0];
  if (account) {
    try {
      const tokenResponse = await msalInstance.acquireTokenSilent({
        ...tokenRequest,
        account
      });

      const token = tokenResponse.accessToken;
      sessionStorage.setItem("authToken", token);

      renderAuthButtons(true);

      // Optional: redirect logic on homepage
      if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
        const res = await fetch("https://corelord-backend.azurewebsites.net/api/profile", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (res.status === 200) {
          window.location.href = "dashboard.html";
        } else if (res.status === 404) {
          window.location.href = "profile.html";
        }
      }
    } catch (err) {
      console.warn("Token acquisition failed silently:", err);
      renderAuthButtons(false);
    }
  } else {
    renderAuthButtons(false);
  }
});

function renderAuthButtons(isSignedIn) {
  const container = document.getElementById("auth-buttons");
  if (!container) return;

  container.innerHTML = "";

  if (isSignedIn) {
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Logout";
    logoutBtn.className = "bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white";
    logoutBtn.onclick = logout;
    container.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Login";
    loginBtn.className = "bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white";
    loginBtn.onclick = login;
    container.appendChild(loginBtn);
  }
}

async function login() {
  try {
    const loginResponse = await msalInstance.loginPopup(tokenRequest);
    account = loginResponse.account;

    const tokenResponse = await msalInstance.acquireTokenSilent({
      ...tokenRequest,
      account
    });

    sessionStorage.setItem("authToken", tokenResponse.accessToken);
    renderAuthButtons(true);

    // Fetch profile and redirect accordingly
    const res = await fetch("https://corelord-backend.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${tokenResponse.accessToken}`
      }
    });

    if (res.status === 200) {
      window.location.href = "dashboard.html";
    } else if (res.status === 404) {
      window.location.href = "profile.html";
    } else {
      alert("Unexpected response from server.");
    }
  } catch (err) {
    console.error("Login failed:", err);
    alert("Login failed.");
  }
}

function logout() {
  msalInstance.logoutPopup().then(() => {
    sessionStorage.removeItem("authToken");
    window.location.href = "index.html";
  });
}
