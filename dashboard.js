function getToken() {
  return sessionStorage.getItem("authToken");
}

function logout() {
  localStorage.removeItem("corelord_token");
  sessionStorage.clear();
  window.location.href = "/";
}

async function loadProfile() {
  try {
    const response = await fetch("https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/profile", {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      console.error("❌ Failed to fetch profile:", response.status);
      return;
    }

    const profile = await response.json();

    // Preferred break
    document.getElementById("preferredBreak").textContent = profile.region || "Not set";

    // Weekly availability
    const availList = document.getElementById("availabilityList");
    availList.innerHTML = "";
    (profile.availability || []).forEach(day => {
      const li = document.createElement("li");
      li.textContent = day;
      availList.appendChild(li);
    });

  } catch (err) {
    console.error("❌ Error loading profile:", err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  document.getElementById("logoutBtn").addEventListener("click", logout);
});
