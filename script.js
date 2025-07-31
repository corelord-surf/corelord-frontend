const msalConfig = {
  auth: {
    clientId: "d5588e78-ac05-4a5f-8c0f-490e5547dd3c", // corelord-frontend
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://agreeable-ground-04732bc03.1.azurestaticapps.net"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// DOM elements
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

let account = null;

// Handle login
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

    account = result.account;
    localStorage.setItem("corelord_token", result.accessToken);

    checkProfileAndRedirect();
  } catch (err) {
    console.error("Login failed:", err);
    alert("Login error. Check console.");
  }
}

// Handle logout
function signOut() {
  msalInstance.logoutPopup();
  localStorage.removeItem("corelord_token");
  location.reload();
}

// Check if profile exists, then route
async function checkProfileAndRedirect() {
  const token = localStorage.getItem("corelord_token");
  if (!token) return;

  try {
    const response = await fetch("https://corelord-api.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 200) {
      // Profile exists → go to dashboard
      window.location.href = "dashboard.html";
    } else if (response.status === 404) {
      // Profile not found → go to setup
      window.location.href = "profile.html";
    } else {
      throw new Error(`Unexpected response: ${response.status}`);
    }
  } catch (error) {
    console.error("Error checking profile:", error);
    alert("Could not load profile. See console for details.");
  }
}

// Add buttons dynamically (optional)
function setupButtons() {
  if (loginBtn) loginBtn.addEventListener("click", signIn);
  if (logoutBtn) logoutBtn.addEventListener("click", signOut);
}

// Auto-login logic
window.onload = async () => {
  setupButtons();

  const token = localStorage.getItem("corelord_token");

  if (token) {
    // Check if still valid — optionally refresh or validate
    try {
      await checkProfileAndRedirect();
    } catch (e) {
      console.warn("Token check failed. Staying on landing.");
    }
  }
};
