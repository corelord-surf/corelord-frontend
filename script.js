const msalConfig = {
  auth: {
    clientId: "825d8657-c509-42b6-9107-dd5e39268723",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://agreeable-ground-04732bc03.1.azurestaticapps.net"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

let msalInstance;
if (window.msal) {
  msalInstance = new msal.PublicClientApplication(msalConfig);
} else {
  console.error("MSAL is not loaded. Make sure to include the MSAL script in your HTML.");
}

// Sign in and redirect to the correct page
async function signIn() {
  try {
    const loginResponse = await msalInstance.loginPopup({
      scopes: ["openid", "profile", "email"],
    });

    console.log("Logged in as:", loginResponse.account.username);

    const account = loginResponse.account;
    const tokenResponse = await msalInstance.acquireTokenSilent({
      scopes: ["openid", "profile", "email"],
      account,
    });

    const token = tokenResponse.accessToken;
    sessionStorage.setItem("authToken", token);

    // Check if profile exists
    const res = await fetch("https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 404) {
      window.location.href = "profile.html";
    } else if (res.ok) {
      window.location.href = "surf.html";
    } else {
      console.error("Unexpected profile response:", res.status);
      alert("Something went wrong while checking your profile.");
    }
  } catch (err) {
    console.error("Sign-in error:", err);
    alert("Sign-in failed. See console for details.");
  }
}

// Optional: Stub for future SignUp handling
function signUp() {
  signIn(); // For now, Sign Up just behaves like Sign In
}

// Render login/logout buttons dynamically
function renderAuthButtons() {
  const account = msalInstance.getAllAccounts()[0];
  const container = document.getElementById("auth-buttons");
  container.innerHTML = "";

  if (account) {
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Logout";
    logoutBtn.className = "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded";
    logoutBtn.onclick = () => {
      msalInstance.logoutRedirect();
    };
    container.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Login";
    loginBtn.className = "bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2";
    loginBtn.onclick = () => signIn();

    const signUpBtn = document.createElement("button");
    signUpBtn.textContent = "Sign Up";
    signUpBtn.className = "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded";
    signUpBtn.onclick = () => signUp();

    container.appendChild(loginBtn);
    container.appendChild(signUpBtn);
  }
}

window.addEventListener("DOMContentLoaded", renderAuthButtons);
