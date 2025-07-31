const msalConfig = {
  auth: {
    clientId: "825d8657-c509-42b6-9107-dd5e39268723", // frontend app client ID
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480", // tenant ID
    redirectUri: "https://agreeable-ground-04732bc03.1.azurestaticapps.net" // static frontend
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

    // Call backend to see if profile exists
    const response = await fetch("https://corelord-app-acg2g4b4abnc8bh.westeurope-01.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 200) {
      window.location.href = "/dashboard.html";
    } else if (response.status === 404) {
      window.location.href = "/profile.html";
    } else {
      console.error("Unexpected response checking profile:", response.status);
      alert("Error checking your profile. Please try again.");
    }
  } catch (err) {
    console.error("Login failed:", err);
    alert("Login failed. See console for details.");
  }
}

async function signOut() {
  const logoutRequest = {
    account: msalInstance.getAllAccounts()[0]
  };
  await msalInstance.logoutPopup(logoutRequest);
  sessionStorage.removeItem("authToken");
  localStorage.removeItem("corelord_token");
  window.location.href = "/";
}

window.onload = function () {
  const authButtons = document.getElementById("auth-buttons");

  if (authButtons) {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Login";
    loginBtn.className = "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded";
    loginBtn.onclick = signIn;

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Logout";
    logoutBtn.className = "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded ml-2";
    logoutBtn.onclick = signOut;

    const token = sessionStorage.getItem("authToken");
    if (token) {
      authButtons.appendChild(logoutBtn);
    } else {
      authButtons.appendChild(loginBtn);
    }
  }
};
