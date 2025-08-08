/* global Chart */

// ======= CONFIG =======
const API_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";

// Surf breaks to expose publicly. (You can add more later.)
// Coxos currently fails due to rate-limit; keep it out for now or add back when cached.
const PUBLIC_BREAKS = [
  { id: 15, name: "Ribeira D'Ilhas" },
  { id: 22, name: "Anglesea" },
  { id: 37, name: "Point Impossible" },
  { id: 46, name: "Torquay Point" }
];

// ======= DOM =======
const els = {
  select: document.getElementById("breakSelect"),
  hours: document.getElementById("hoursInput"),
  refresh: document.getElementById("refreshBtn"),
  hourlyBtn: document.getElementById("hourlyBtn"),
  dailyBtn: document.getElementById("dailyBtn"),
  meta: document.getElementById("metaInfo"),
  chart: document.getElementById("forecastChart"),
  error: document.getElementById("errorBox"),
  toast: document.getElementById("toast"),
  toggles: {
    wave: document.getElementById("toggleWave"),
    wind: document.getElementById("toggleWind"),
    tide: document.getElementById("toggleTide")
  }
};

let state = {
  mode: "hourly", // or 'daily'
  dataRaw: null,  // API response
  chart: null
};

// ======= Helpers =======
const kt = n => (n == null ? null : Math.round(n * 10) / 10);
const m  = n => (n == null ? null : Math.round(n * 100) / 100);
const s1 = n => (n == null ? null : Math.round(n * 10) / 10);

function showToast(msg, ms = 3000) {
  els.toast.textContent = msg;
  els.toast.style.display = "block";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { els.toast.style.display = "none"; }, ms);
}

function fmtTime(ts) {
  return new Date(ts * 1000).toLocaleString();
}

function groupDaily(items) {
  // Aggregate by date (local TZ of viewer) – max wave, avg wind, avg tide
  const map = new Map();
  for (const it of items) {
    const d = new Date(it.ts * 1000);
    const key = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    let o = map.get(key);
    if (!o) o = { dateKey: key, ts: Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())/1000, waves: [], winds: [], tides: [] };
    o.waves.push(it.waveHeightM);
    o.winds.push(it.windSpeedKt);
    if (it.tideM != null) o.tides.push(it.tideM);
    map.set(key, o);
  }
  const out = [...map.values()].map(r => {
    const maxWave = r.waves.reduce((a,b)=>Math.max(a, b ?? 0), 0);
    const winds = r.winds.filter(v=>v!=null);
    const tides = r.tides.filter(v=>v!=null);
    const avgWind = winds.length ? winds.reduce((a,b)=>a+b,0)/winds.length : null;
    const avgTide = tides.length ? tides.reduce((a,b)=>a+b,0)/tides.length : null;
    return {
      ts: r.ts,
      waveHeightM: m(maxWave),
      windSpeedKt: s1(avgWind),
      tideM: m(avgTide)
    };
  });
  // keep chronological
  out.sort((a,b) => a.ts - b.ts);
  return out;
}

function buildDatasets(items) {
  const labels = items.map(i => fmtTime(i.ts));

  const dsWave = {
    label: "Wave Height (m)",
    data: items.map(i => i.waveHeightM),
    borderColor: "#58a6ff",
    backgroundColor: "rgba(88, 166, 255, 0.15)",
    borderWidth: 2,
    tension: 0.3,
    yAxisID: "yWaves",
    hidden: !els.toggles.wave.checked
  };
  const dsWind = {
    label: "Wind Speed (kt)",
    data: items.map(i => i.windSpeedKt),
    borderColor: "#ffa657",
    backgroundColor: "rgba(255, 166, 87, 0.15)",
    borderWidth: 2,
    tension: 0.3,
    yAxisID: "yWind",
    hidden: !els.toggles.wind.checked
  };
  const dsTide = {
    label: "Tide / Sea level (m)",
    data: items.map(i => i.tideM),
    borderColor: "#7ee787",
    backgroundColor: "rgba(126, 231, 135, 0.15)",
    borderDash: [5, 5],
    pointRadius: 0,
    borderWidth: 2,
    tension: 0.3,
    yAxisID: "yWaves", // meters, same axis as waves
    hidden: !els.toggles.tide.checked
  };

  return { labels, datasets: [dsWave, dsWind, dsTide] };
}

function renderChart(items) {
  const { labels, datasets } = buildDatasets(items);

  // Destroy previous
  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }

  state.chart = new Chart(els.chart, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: "#e6edf3" }
        },
        tooltip: {
          callbacks: {
            // Show swell direction/period if present in raw item for hourly mode
            afterBody: (ctx) => {
              if (state.mode !== 'hourly') return;
              const i = ctx[0].dataIndex;
              const it = state.dataRaw?.items?.[i];
              if (!it) return;
              const dir = it.swellDir != null ? Math.round(it.swellDir) + "°" : null;
              const per = it.swellPeriodS != null ? s1(it.swellPeriodS) + "s" : null;
              if (dir || per) return `Swell: ${[dir, per].filter(Boolean).join(" @ ")}`;
            }
          }
        }
      },
      scales: {
        yWaves: {
          type: "linear",
          position: "left",
          title: { display: true, text: "Meters", color: "#9da7b1" },
          grid: { color: "rgba(240,246,252,0.06)" },
          ticks: { color: "#c9d1d9" }
        },
        yWind: {
          type: "linear",
          position: "right",
          title: { display: true, text: "Knots", color: "#9da7b1" },
          grid: { drawOnChartArea: false },
          ticks: { color: "#c9d1d9" }
        },
        x: {
          ticks: { color: "#c9d1d9", maxRotation: 60, minRotation: 45 },
          grid: { color: "rgba(240,246,252,0.06)" }
        }
      }
    }
  });
}

function setMode(mode) {
  state.mode = mode;
  els.hourlyBtn.classList.toggle("active", mode === "hourly");
  els.dailyBtn.classList.toggle("active", mode === "daily");

  if (!state.dataRaw?.items?.length) return;

  const hourly = state.dataRaw.items;
  const items = mode === "hourly" ? hourly : groupDaily(hourly);
  renderChart(items);
}

// ======= Fetch =======
async function fetchForecast(breakId, hours) {
  els.error.style.display = "none";
  els.meta.textContent = "Loading…";

  try {
    const url = `${API_URL}/api/forecast/timeseries?breakId=${breakId}&hours=${hours}&includeTide=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      els.meta.textContent = "No forecast data available.";
      els.error.style.display = "block";
      return;
    }

    state.dataRaw = data;

    els.meta.textContent =
      `${data.break?.name ?? data.break?.Name ?? "Surf Break"} • ` +
      `${data.hours}h • From Cache: ${data.fromCache ? "Yes" : "No"}`;

    setMode(state.mode); // re-render in current mode
    showToast(`Loaded ${data.items.length} hours for ${data.break?.name ?? data.break?.Name || "break"}`);
  } catch (err) {
    console.error("Forecast error:", err);
    els.error.style.display = "block";
    els.meta.textContent = "";
    showToast("Failed to load forecast.", 4000);
  }
}

// ======= Wiring =======
function init() {
  // Populate select
  for (const b of PUBLIC_BREAKS) {
    const opt = document.createElement("option");
    opt.value = String(b.id);
    opt.textContent = b.name;
    els.select.appendChild(opt);
  }

  // Events
  els.refresh.addEventListener("click", () => {
    fetchForecast(Number(els.select.value), Number(els.hours.value));
  });
  els.select.addEventListener("change", () => {
    fetchForecast(Number(els.select.value), Number(els.hours.value));
  });
  els.hours.addEventListener("change", () => {
    // keep within bounds
    const v = Math.max(12, Math.min(168, Number(els.hours.value) || 72));
    els.hours.value = String(v);
    fetchForecast(Number(els.select.value), v);
  });
  els.hourlyBtn.addEventListener("click", () => setMode("hourly"));
  els.dailyBtn.addEventListener("click", () => setMode("daily"));

  // legend toggles
  els.toggles.wave.addEventListener("change", () => setMode(state.mode));
  els.toggles.wind.addEventListener("change", () => setMode(state.mode));
  els.toggles.tide.addEventListener("change", () => setMode(state.mode));

  // Initial
  els.select.value = String(PUBLIC_BREAKS[0].id);
  fetchForecast(PUBLIC_BREAKS[0].id, Number(els.hours.value));
}

document.addEventListener("DOMContentLoaded", init);
