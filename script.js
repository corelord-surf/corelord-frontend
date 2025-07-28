
document.getElementById('surfForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const surfBreak = document.getElementById('surfBreak').value;
  const availability = document.getElementById('availability').value.split(',').map(day => day.trim());
  const conditions = document.getElementById('conditions').value;

  const response = await fetch('https://corelord-app-acg2g4b4a8bnc8bh.westeurope-01.azurewebsites.net/api/surfplan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ break: surfBreak, availability, conditions })
  });

  const data = await response.json();
  document.getElementById('result').innerText = data.plan || data.error;
});
