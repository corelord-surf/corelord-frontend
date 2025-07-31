const msalConfig = {
  auth: {
    clientId: "825d8657-c509-42b6-9107-dd5e39268723", // corelord-frontend
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://agreeable-ground-04732bc03.1.azurestaticapps.net"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

async function signIn() {
  try {
    const result = await msalInstance.loginPopup({
      scopes: [
        "openid",
        "profile",
        "email",
        "api://a56c161a-b280-4f07-8c07-b37c51044c56/access_as_user"
      ]
    });

    localStorage.setItem("corelord_token", result.accessToken);
    sessionStorage.setItem("authToken", result.accessToken);

    // Check profile existence
    const response = await fetch("https://corelord-surf.azurewebsites.net/api/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${result.accessToken}`
      }
    });

    const redirectUrl = response.status === 404 ? "profile.html" : "dashboard.html";
    window.location.href = redirectUrl;

  } catch (error) {
    console.error("Login failed:", error);
  }
}

function renderAuthButtons() {
  const container = document.getElementById("auth-buttons");
  if (!container) return;

  container.innerHTML = "";
  if (sessionStorage.getItem("authToken")) {
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Logout";
    logoutBtn.className = "bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white";
    logoutBtn.onclick = () => {
      sessionStorage.removeItem("authToken");
      localStorage.removeItem("corelord_token");
      window.location.href = "index.html";
    };
    container.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Login";
    loginBtn.className = "bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white";
    loginBtn.onclick = signIn;
    container.appendChild(loginBtn);
  }
}

window.onload = renderAuthButtons;
