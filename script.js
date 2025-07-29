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
        "Authorization": `Bearer ${token}`
      }
    });

    if (res.status === 404) {
      window.location.href = "profile.html";
    } else {
      window.location.href = "surf.html"; // Next screen
    }
  } catch (err) {
    console.error("Sign-in error:", err);
    alert("Sign-in failed. See console for details.");
  }
}
