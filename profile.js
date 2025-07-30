document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = sessionStorage.getItem("authToken");

  const displayName = document.getElementById("displayName").value;
  const region = document.getElementById("region").value;
  const daily = document.getElementById("daily").checked;
  const weekly = document.getElementById("weekly").checked;

  const availability = Array.from(document.querySelectorAll(".availability-slot:checked"))
    .map(cb => cb.value);

  const profile = {
    name: displayName,
    region,
    phone: "", // optional, placeholder
    updates: [],
    availability
  };

  const res = await fetch("https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(profile)
  });

  if (res.ok) {
    alert("Profile saved!");
    window.location.href = "surf.html";
  } else {
    alert("Error saving profile");
  }
});
