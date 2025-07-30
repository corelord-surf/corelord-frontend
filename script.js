const msalConfig = {
  auth: {
    clientId: "825d8657-c509-42b6-9107-dd5e39268723",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://agreeable-ground-04732bc03.1.azurestaticapps.net",
  },
};
const msalInstance = new msal.PublicClientApplication(msalConfig);
let account;

async function signIn() {
  try {
    const result = await msalInstance.loginPopup({ scopes: ["openid", "profile", "email"] });
    account = result.account;
    localStorage.setItem("corelord_token", result.idToken);
    document.getElementById("auth-buttons").innerHTML = `<button onclick="logout()" class="bg-red-600 px-4 py-2 rounded text-white">Logout</button>`;
    checkProfileAndRedirect();
  } catch (err) {
    console.error("❌ Sign-in error:", err);
    alert("Sign-in failed. See console for details.");
  }
}

function logout() {
  msalInstance.logoutPopup();
  localStorage.removeItem("corelord_token");
  window.location.href = "/";
}

function getToken() {
  return localStorage.getItem("corelord_token");
}

async function checkProfileAndRedirect() {
  try {
    const response = await fetch("https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${getToken()}`
      },
      credentials: "include"
    });

    if (response.status === 404) {
      window.location.href = "/profile.html";
    } else if (response.ok) {
      window.location.href = "/dashboard.html";
    } else {
      console.warn("⚠️ Unknown response from /api/profile");
    }
  } catch (err) {
    console.error("Profile check error:", err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const currentAccounts = msalInstance.getAllAccounts();
  if (currentAccounts.length > 0) {
    account = currentAccounts[0];
    document.getElementById("auth-buttons").innerHTML = `<button onclick="logout()" class="bg-red-600 px-4 py-2 rounded text-white">Logout</button>`;
    if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
      checkProfileAndRedirect();
    }
  } else {
    document.getElementById("auth-buttons").innerHTML = `<button onclick="signIn()" class="bg-blue-600 px-4 py-2 rounded text-white">Sign In</button>`;
  }
});
