const msalConfig = {
  auth: {
    clientId: "825d8657-c509-42b6-9107-dd5e39268723",
    authority: "https://login.microsoftonline.com/d048d6e2-6e9f-4af0-afcf-58a5ad036480",
    redirectUri: "https://agreeable-ground-04732bc03.1.azurestaticapps.net/surf.html"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

document.addEventListener("DOMContentLoaded", async () => {
  renderAuthButtons();

  const account = msalInstance.getAllAccounts()[0];
  if (!account) {
    alert("You must be signed in to view this page.");
    window.location.href = "index.html";
    return;
  }

  try {
    const tokenResponse = await msalInstance.acquireTokenSilent({
      scopes: ["openid", "profile", "email", "api://315eede8-ee31-4487-b202-81e495e8f9fe/user_impersonation"],
      account,
    });

    const token = tokenResponse.accessToken;
    sessionStorage.setItem("authToken", token);

    const response = await fetch("https://corelord-app.azurewebsites.net/api/profile", {

      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error("Failed to fetch profile");

    const profile = await res.json();
    renderProfile(profile);

    const forecasts = [
      {
        break: "Ericeira, Portugal",
        swell: "1.8m @ 12s",
        wind: "Offshore 15km/h",
        rating: "⭐⭐⭐",
        notes: "Clean morning conditions, building swell into weekend.",
      },
      {
        break: "Torquay, Australia",
        swell: "2.1m @ 10s",
        wind: "Onshore 20km/h",
        rating: "⭐⭐",
        notes: "Messy in the afternoon, early paddle recommended.",
      },
    ];
    renderForecasts(forecasts);

  } catch (err) {
    console.error("Token/profile fetch error:", err);
    alert("Session expired or invalid. Please log in again.");
    window.location.href = "index.html";
  }
});

function renderProfile(profile) {
  const info = document.getElementById("profileInfo");

  const breaks = profile.region || "Not set";
  const availability = JSON.parse(profile.availability || "[]");

  const availabilityFormatted = availability.length
    ? availability.join(", ")
    : "No days selected";

  info.innerHTML = `
    <p><strong>Favourite Break:</strong> ${breaks}</p>
    <p class="mt-2"><strong>Weekly Availability:</strong> ${availabilityFormatted}</p>
  `;
}

function renderForecasts(forecasts) {
  const container = document.getElementById("forecastContainer");

  forecasts.forEach(f => {
    const card = document.createElement("div");
    card.className = "bg-white p-4 shadow rounded";
    card.innerHTML = `
      <h3 class="text-xl font-semibold mb-2">${f.break}</h3>
      <p><strong>Swell:</strong> ${f.swell}</p>
      <p><strong>Wind:</strong> ${f.wind}</p>
      <p><strong>Rating:</strong> ${f.rating}</p>
      <p class="mt-2 text-sm text-gray-600">${f.notes}</p>
    `;
    container.appendChild(card);
  });
}

function renderAuthButtons() {
  const container = document.getElementById("auth-buttons");
  container.innerHTML = "";

  const logoutBtn = document.createElement("button");
  logoutBtn.textContent = "Logout";
  logoutBtn.className = "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded";
  logoutBtn.onclick = () => {
    msalInstance.logoutPopup().then(() => {
      sessionStorage.clear();
      localStorage.removeItem("corelord_token");
      window.location.href = "/";
    });
  };

  container.appendChild(logoutBtn);
}
