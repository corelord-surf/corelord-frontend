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
