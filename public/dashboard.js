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
  scopes: ["openid", "profile", "email", "api://207b8fba-ea72-43e3-8c90-b3a39e58f5fc/user_impersonation"]
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

async function getProfile(token) {
  try {
    const response = await fetch("https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error("API call failed");

    const data = await response.json();
    document.getElementById("name").textContent = data.FullName || "N/A";
    document.getElementById("email").textContent = msalInstance.getAllAccounts()[0]?.username || "N/A";
    document.getElementById("phone").textContent = data.PhoneNumber || "N/A";
    document.getElementById("country").textContent = data.Country || "N/A";
    document.getElementById("profile").style.display = "block";
  } catch (err) {
    console.error("Profile fetch failed:", err);
    document.getElementById("errorMessage").style.display = "block";
  }
}

async function acquireTokenAndLoadProfile() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return redirectToLogin();

  try {
    const result = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0]
    });
    getProfile(result.accessToken);
  } catch (silentError) {
    console.warn("Silent token failed. Trying popup...", silentError);
    try {
      const result = await msalInstance.acquireTokenPopup(loginRequest);
      getProfile(result.accessToken);
    } catch (popupError) {
      console.error("Dashboard error:", popupError);
      document.getElementById("errorMessage").style.display = "block";
    }
  }
}

function redirectToLogin() {
  window.location.href = "index.html";
}

function signOut() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.logout({ account: accounts[0] });
  }
}

window.addEventListener("DOMContentLoaded", acquireTokenAndLoadProfile);
