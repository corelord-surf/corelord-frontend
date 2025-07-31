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
    const response = await fetch("https://corelord-app.azurewebsites.net/api/profile", {
      method: "GET",
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

    // Display preferred break
    document.getElementById("preferredBreak").textContent = profile.region || "Not set";

    // Display weekly availability
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
