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

const msalInstance = new msal.PublicClientApplication(msalConfig);
const scopes = ["openid", "profile", "email", "api://2070bf8a-ea72-43e3-8c90-b3a39e585f5c/user_impersonation"];
let accessToken;

async function loadDashboard() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    msalInstance.loginRedirect({ scopes });
    return;
  }

  const account = accounts[0];

  try {
    const tokenResponse = await msalInstance.acquireTokenSilent({
      scopes,
      account
    });
    accessToken = tokenResponse.accessToken;

    const res = await fetch("https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`
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

msalInstance.handleRedirectPromise()
  .then(loadDashboard)
  .catch(error => {
    console.error("Redirect handling error:", error);
    document.body.innerHTML = "<h2>Authentication error. Please <a href='/'>sign in again</a>.</h2>";
  });

document.getElementById("signOutBtn").addEventListener("click", () => {
  const logoutRequest = {
    account: msalInstance.getAllAccounts()[0]
  };
  msalInstance.logoutRedirect(logoutRequest);
});
