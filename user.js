document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('authToken') || localStorage.getItem('corelord_token');

  if (!token) {
    console.warn("⚠️ No auth token found in session or local storage");
    window.location.href = '/index.html';
    return;
  }

  try {
    const response = await fetch("https://corelord-app.azurewebsites.net/api/profile", {

      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch profile');

    const profile = await response.json();

    document.getElementById('userEmail').textContent = sessionStorage.getItem('userEmail') || profile.email;
    document.getElementById('surfBreak').textContent = profile.region || 'Not set';
    document.getElementById('availability').textContent = (profile.availability || []).join(', ') || 'Not set';

  } catch (err) {
    console.error('Error loading profile:', err);
    document.getElementById('profileSection').innerHTML = '<p class="text-red-600">Failed to load profile. Please try again later.</p>';
  }
});
