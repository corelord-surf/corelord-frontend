document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = sessionStorage.getItem("authToken");
  if (!token) {
    alert("You're not logged in.");
    return;
  }

  const displayName = document.getElementById("displayName").value;
  const region = document.getElementById("region").value;
  const daily = document.getElementById("daily").checked;
  const weekly = document.getElementById("weekly").checked;

  const availability = Array.from(document.querySelectorAll(".availability-slot:checked"))
    .map(cb => cb.value);

  const profile = {
    name: displayName,
    region,
    phone: "", // optional for now
    updates: [],
    availability
  };

  const response = await fetch("https://corelord-app.azurewebsites.net/api/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(profile)
  });

  if (response.ok) {
    alert("Profile saved!");
    window.location.href = "surf.html";
  } else {
    alert("Error saving profile");
    console.error("Profile save failed:", response.status);
  }
});
