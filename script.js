const msalConfig = {
  auth: {
    clientId: "22bcfaaf-5091-464e-8064-ec06eea8a37c0",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
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
  } catch (err) {
    console.error("Login error:", err);
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
  document.getElementById('result').innerText = data.plan || data.error;
});
