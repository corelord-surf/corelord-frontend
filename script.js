const msalConfig = {
  auth: {
    clientId: "825d8657-c509-42b6-9107-dd5e39268723",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480", // Your tenant
    redirectUri: "https://agreeable-ground-04732bc03.1.azurestaticapps.net"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

async function signIn() {
  try {
    const loginResponse = await msalInstance.loginPopup({
      scopes: ["openid", "profile", "email"],
    });
    console.log("Logged in as:", loginResponse.account.username);
    alert(`Signed in as: ${loginResponse.account.username}`);
  } catch (err) {
    console.error("Sign-in error:", err);
    alert("Sign-in failed. See console for details.");
  }
}

function signOut() {
  const logoutRequest = {
    account: msalInstance.getAllAccounts()[0],
    postLogoutRedirectUri: msalConfig.auth.redirectUri,
  };
  msalInstance.logout(logoutRequest);
}

document.getElementById('surfForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const surfBreak = document.getElementById('surfBreak').value;
  const availability = document.getElementById('availability').value.split(',').map(day => day.trim());
  const conditions = document.getElementById('conditions').value;

  const response = await fetch('https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/surfplan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ break: surfBreak, availability, conditions })
  });

  const data = await response.json();
  document.getElementById('result').innerText = data.plan || data.error || "No response from server.";
});
