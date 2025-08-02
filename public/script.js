const msalConfig = {
  auth: {
    clientId: "7258cfca-e901-4077-8fba-224f8bc595e4", // corelord-github-deploy
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://calm-coast-025fe8203.2.azurestaticapps.net/profile.html"
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
    const loginResponse = await msalInstance.loginPopup({
      scopes: ["openid", "profile", "email"]
    });
    account = loginResponse.account;
    sessionStorage.setItem("userEmail", account.username);
    document.getElementById("email").value = account.username;
  } catch (err) {
    console.error("Login failed", err);
  }
}

async function submitProfile(event) {
  event.preventDefault();

  const profileData = {
    name: document.getElementById("name").value,
    preferredBreak: "",  // placeholder
    availability: [],    // placeholder
    country: document.getElementById("country").value,
    phone: document.getElementById("phone").value
  };

  try {
    const response = await fetch("https://corelord-backend-etgpd9dfdufargfb.westeurope.azurewebsites.net/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profileData)
    });

    if (response.ok) {
      window.location.href = "/dashboard";
    } else {
      throw new Error("Failed to submit profile.");
    }
  } catch (err) {
    console.error("Submission error:", err);
    document.getElementById("status").innerText = "Failed to submit profile.";
  }
}

window.onload = async () => {
  await signIn();
  document.getElementById("profileForm").addEventListener("submit", submitProfile);
};
