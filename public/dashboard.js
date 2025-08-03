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

async function getAccessToken(account) {
  try {
    const response = await msalInstance.acquireTokenSilent({ scopes, account });
    return response.accessToken;
  } catch (error) {
    console.warn("Silent token failed. Falling back to popup.");
    if (error instanceof msal.InteractionRequiredAuthError) {
      const popupResponse = await msalInstance.acquireTokenPopup({ scopes });
      return popupResponse.accessToken;
    } else {
      throw error;
    }
  }
}

async function loadDashboard() {
  let account = null;
  const accounts = msalInstance.getAllAccounts();

  if (accounts.length === 0) {
    try {
      const loginResponse = await msalInstance.loginPopup({ scopes });
      account = loginResponse.account;
    } catch (loginError) {
      console.error("Login popup failed", loginError);
      document.body.innerHTML = "<h2>Authentication required. Please <a href='/'>sign in</a>.</h2>";
      return;
    }
  } else {
    account = accounts[0];
  }

  try {
    const token = await getAccessToken(account);

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
    console.error("Error loading dashboard:", err);
    document.body.innerHTML = "<h2>Session expired or access denied. Please <a href='/'>sign in again</a>.</h2>";
  }
}

loadDashboard();

document.getElementById("signOutBtn").addEventListener("click", () => {
  const logoutRequest = {
    account: msalInstance.getAllAccounts()[0]
  };
  msalInstance.logoutRedirect(logoutRequest);
});
