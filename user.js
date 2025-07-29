document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('accessToken');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  try {
    const response = await fetch('https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch profile');

    const profile = await response.json();

    document.getElementById('userEmail').textContent = sessionStorage.getItem('userEmail');
    document.getElementById('surfBreak').textContent = profile.surfBreak || 'Not set';
    document.getElementById('availability').textContent = (profile.weeklyAvailability || []).join(', ') || 'Not set';

  } catch (err) {
    console.error('Error loading profile:', err);
    document.getElementById('profileSection').innerHTML = '<p class="text-red-600">Failed to load profile. Please try again later.</p>';
  }
});
