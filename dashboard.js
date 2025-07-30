function getToken() {
  return localStorage.getItem("corelord_token");
}

async function loadProfile() {
  try {
    const response = await fetch("https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json"
      },
      credentials: "include"
    });

    if (!response.ok) {
      console.error(`❌ Failed to load profile: ${response.status}`);
      return;
    }

    const profile = await response.json();

    document.getElementById("surf-break").textContent = profile.region || "Not set";
    document.getElementById("availability").textContent = (profile.availability || []).join(", ") || "None selected";

  } catch (err) {
    console.error("❌ Error fetching profile:", err);
  }
}

window.addEventListener("DOMContentLoaded", loadProfile);
