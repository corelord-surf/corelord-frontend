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
    const result = await msalInstance.loginPopup({
      scopes: [
        "openid",
        "profile",
        "email",
        "api://825d8657-c509-42b6-9107-dd5e39268723/access_as_user"
      ]
    });

    account = result.account;

    // ✅ Store accessToken for API use
    localStorage.setItem("corelord_token", result.accessToken);
    sessionStorage.setItem("authToken", result.accessToken);
    sessionStorage.setItem("userEmail", account.username);

    renderAuthButton(true);
    checkProfileAndRedirect();
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

window.addEventListener("DOMContentLoaded", () => {
  const currentAccounts = msalInstance.getAllAccounts();
  const token = getToken();

  if (currentAccounts.length > 0 && token) {
    account = currentAccounts[0];
    renderAuthButton(true);

    if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
      checkProfileAndRedirect();
    }
  } else {
    renderAuthButton(false);
  }
});
