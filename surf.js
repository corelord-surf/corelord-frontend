document.addEventListener("DOMContentLoaded", async () => {
  const token = sessionStorage.getItem("authToken");

  if (!token) {
    alert("You must be signed in to view this page.");
    window.location.href = "index.html";
    return;
  }

  try {
    // Fetch and display saved profile
    const profileRes = await fetch("https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const profile = await profileRes.json();
    renderProfile(profile);
  } catch (err) {
    console.error("Failed to load profile:", err);
    document.getElementById("profileInfo").innerText = "Couldn't load your profile.";
  }

  // Dummy forecast data
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
});

function renderProfile(profile) {
  const info = document.getElementById("profileInfo");
  const favBreaks = profile.breaks?.join(", ") || "None selected";
  const times = Object.entries(profile.availability || {})
    .map(([day, slots]) => `${day}: ${slots.join(", ")}`)
    .join("<br>");

  info.innerHTML = `
    <p><strong>Favourite Breaks:</strong> ${favBreaks}</p>
    <p class="mt-2"><strong>Your Weekly Availability:</strong><br>${times}</p>
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
