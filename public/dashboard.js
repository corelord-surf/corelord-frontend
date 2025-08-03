const msalConfig = {
  auth: {
    clientId: "2070bf8a-ea72-43e3-8c90-b3a39e585f5c",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/dashboard.html"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);
const scopes = ["openid", "profile", "email", "api://2070bf8a-ea72-43e3-8c90-b3a39e585f5c/user_impersonation"];

async function ensureLoggedInAndLoadProfile() {
  let account = null;
  let token = null;

  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      const loginResult = await msalInstance.loginPopup({ scopes });
      account = loginResult.account;
    } else {
      account = accounts[0];
    }

    try {
      const tokenResponse = await msalInstance.acquireTokenSilent({ scopes, account });
      token = tokenResponse.accessToken;
    } catch (silentErr) {
      console.warn("Silent token failed. Trying popup...");
      const popupResponse = await msalInstance.acquireTokenPopup({ scopes });
      token = popupResponse.accessToken;
    }

    const res = await fetch("https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error("Failed to fetch profile");

    const profile = await res.json();
    document.getElementById("email").textContent = profile.email || "";
    document.getElementById("name").textContent = profile.name || "";
    document.getElementById("country").textContent = profile.country || "";
    document.getElementById("phone").textContent = profile.phone || "";

  } catch (err) {
    console.error("Dashboard error:", err);
    document.body.innerHTML = "<h2>Session expired or access denied. Please <a href='/'>sign in again</a>.</h2>";
  }
}

ensureLoggedInAndLoadProfile();

document.getElementById("signOutBtn").addEventListener("click", () => {
  const logoutRequest = {
    account: msalInstance.getAllAccounts()[0]
  };
  msalInstance.logoutRedirect(logoutRequest);
});
