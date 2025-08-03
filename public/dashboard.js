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

async function loadDashboard(account, token) {
  try {
    const res = await fetch("https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error("Profile fetch failed");

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

msalInstance.handleRedirectPromise().then(async (result) => {
  let account = null;
  if (result && result.account) {
    account = result.account;
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      msalInstance.loginRedirect({ scopes });
      return;
    }
    account = accounts[0];
  }

  try {
    const response = await msalInstance.acquireTokenSilent({ scopes, account });
    await loadDashboard(account, response.accessToken);
  } catch (err) {
    console.warn("Silent token failed, redirecting to re-authenticate");
    msalInstance.acquireTokenRedirect({ scopes });
  }
}).catch(err => {
  console.error("Redirect error:", err);
  document.body.innerHTML = "<h2>Authentication error. Please <a href='/'>sign in again</a>.</h2>";
});

document.getElementById("signOutBtn").addEventListener("click", () => {
  const logoutRequest = {
    account: msalInstance.getAllAccounts()[0]
  };
  msalInstance.logoutRedirect(logoutRequest);
});
