const msalConfig = {
  auth: {
    clientId: "d5588e78-ac05-4a5f-8c0f-490e5547dd3c", // corelord-frontend app
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480", // tenant
    redirectUri: "https://agreeable-ground-04732bc03.1.azurestaticapps.net"
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
        "api://a56c161a-b280-4f07-8c07-b37c51044c56/access_as_user"
      ]
    });

    account = result.account;
    localStorage.setItem("corelord_token", result.accessToken);
    sessionStorage.setItem("authToken", result.accessToken);
    console.log("✅ Logged in:", account.username);
    window.location.href = "/dashboard.html";
  } catch (error) {
    console.error("❌ Sign-in failed", error);
  }
}
