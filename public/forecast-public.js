/* Forecast Public UI - CoreLord
 * Uses shared nav.js/nav.css for layout uniformity
 * Buttons: #btnDaily (24h), #btnWeekly (168h)
 */

(() => {
  const API_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";

  // Add/remove breaks here.
  const BREAKS = [
    { id: 15, name: "Ribeira D'ilhas" },
    { id: 2,  name: "Cave" },
    { id: 3,  name: "Coxos" },
    { id: 37, name: "Point Impossible" },
    { id: 43, name: "Steps" },
    { id: 46, name: "Torquay Point" },
  ];

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const els = {
    breakSelect: $("breakSelect"),
    btnRefresh: $("btnRefresh"),
    btnDaily: $("btnDaily"),
    btnWeekly: $("btnWeekly"),
    chkWave: $("chkWave"),
    chkWind: $("chkWind"),
    chkTide: $("chkTide"),
    metaInfo: $("metaInfo"),
    canvas: $("forecastChart"),
    errorBox: $("errorBox"),
  };

  // Populate break dropdown once
  if (els.breakSelect && !els.breakSelect.options.length) {
    for (const b of BREAKS) {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = b.name;
      els.breakSelect.appendChild(opt);
    }
  }

  // Chart instance
  let chart = null;
  const ctx = els.canvas ? els.canvas.getContext("2d") : null;

  // Small helpers
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const setStatus = (text) => { if (els.metaInfo) els.metaInfo.textContent = text; };
  const setError = (msg) => {
    if (!els.errorBox) return;
    if (msg) {
      els.errorBox.textContent = msg;
      els.errorBox.style.display = "block";
    } else {
      els.errorBox.style.display = "none";
    }
  };

  // X-axis formatting
  const tsToHourLabel = (sec) =>
    new Date(sec * 1000).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

  // Group to daily for weekly view
  function groupDaily(items) {
    const byDay = new Map(); // YYYY-MM-DD -> { wave:[], wind:[], tide:[], sampleTs: number }
    for (const it of items) {
      const d = new Date(it.ts * 1000);
      const key = d.toISOString().slice(0, 10);
      let row = byDay.get(key);
      if (!row) {
        row = { wave: [], wind: [], tide: [], sampleTs: it.ts };
        byDay.set(key, row);
      }
      if (typeof it.waveHeightM === "number") row.wave.push(it.waveHeightM);
      if (typeof it.windSpeedKt === "number") row.wind.push(it.windSpeedKt);
      if (typeof it.tideM === "number") row.tide.push(it.tideM);
    }

    // preserve order by day
    const days = [...byDay.entries()].sort((a, b) => a[1].sampleTs - b[1].sampleTs);
    const labels = [];
    const wave = [];
    const wind = [];
    const tide = [];
    for (const [, v] of days) {
      labels.push(new Date(v.sampleTs * 1000).toLocaleDateString(undefined, { weekday: "short", day: "2-digit" }));
      wave.push(v.wave.length ? Math.max(...v.wave) : null);
      wind.push(v.wind.length ? Math.max(...v.wind) : null);
      tide.push(v.tide.length ? avg(v.tide) : null);
    }
    return { labels, wave, wind, tide };
  }

  function makeChart(labels, series, mode) {
    if (!ctx) return;
    if (chart) chart.destroy();

    const maxTicks = mode === "weekly" ? 7 : 10;

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Wave Height (m)",
            data: series.wave,
            yAxisID: "yWave",
            borderWidth: 2,
            tension: 0.3,
            hidden: !els.chkWave?.checked,
          },
          {
            label: "Wind Speed (kt)",
            data: series.wind,
            yAxisID: "yWind",
            borderWidth: 2,
            tension: 0.3,
            hidden: !els.chkWind?.checked,
          },
          {
            label: "Tide / Sea level (m)",
            data: series.tide,
            yAxisID: "yTide",
            borderWidth: 2,
            tension: 0.3,
            hidden: !els.chkTide?.checked,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#e6edf3" } },
        },
        scales: {
          x: {
            ticks: { color: "#9aa0a6", autoSkip: true, maxTicksLimit: maxTicks },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
          yWave: {
            position: "left",
            title: { display: true, text: "Wave (m)" },
            ticks: { color: "#9aa0a6" },
            grid: { color: "rgba(88,166,255,0.15)" },
          },
          yWind: {
            position: "right",
            title: { display: true, text: "Wind (kt)" },
            ticks: { color: "#9aa0a6" },
            grid: { display: false },
            min: 0,
          },
          yTide: {
            position: "right",
            title: { display: true, text: "Tide (m)" },
            ticks: { color: "#9aa0a6" },
            grid: { display: false },
          },
        },
      },
    });
  }

  // Toggle dataset visibility when checkboxes change
  [["chkWave", 0], ["chkWind", 1], ["chkTide", 2]].forEach(([id, idx]) => {
    const el = els[id];
    if (el) {
      el.addEventListener("change", () => {
        if (!chart) return;
        chart.setDatasetVisibility(idx, el.checked);
        chart.update();
      });
    }
  });

  // Fetch + shape
  async function loadForecast({ breakId, hours }) {
    const url = `${API_URL}/api/forecast/timeseries?breakId=${breakId}&hours=${hours}&includeTide=1`;
    const t0 = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    const txt = await res.text();
    const ms = Math.round(performance.now() - t0);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    let data = JSON.parse(txt);
    return { data, ms };
  }

  function shapeHourly(items) {
    const labels = items.map(i => tsToHourLabel(i.ts));
    const wave = items.map(i => i.waveHeightM ?? null);
    const wind = items.map(i => i.windSpeedKt ?? null);
    const tide = items.map(i => i.tideM ?? null);
    return { labels, wave, wind, tide };
  }

  // UI state
  let mode = "weekly"; // default to weekly so users see 7d immediately

  function setMode(next) {
    mode = next;
    els.btnDaily?.classList.toggle("active", mode === "daily");
    els.btnWeekly?.classList.toggle("active", mode === "weekly");
    refresh();
  }

  async function refresh() {
    try {
      setError("");
      const breakId = parseInt(els.breakSelect?.value || "15", 10);
      const hours = mode === "daily" ? 24 : 168;

      setStatus("Loading…");
      const { data, ms } = await loadForecast({ breakId, hours });

      const name = data?.break?.name || data?.break?.Name || `#${breakId}`;
      setStatus(`${name} • ${data?.hours ?? "?"}h • fromCache: ${data?.fromCache ? "yes" : "no"} • ${ms}ms`);

      const items = Array.isArray(data?.items) ? data.items : [];
      if (!items.length) {
        setError("No forecast data available.");
        if (chart) { chart.destroy(); chart = null; }
        return;
      }

      const series = mode === "weekly" ? groupDaily(items) : shapeHourly(items);
      makeChart(series.labels, series, mode);
    } catch (e) {
      setStatus("Load failed");
      setError(e.message || String(e));
      if (chart) { chart.destroy(); chart = null; }
      console.error("[forecast-public] error:", e);
    }
  }

  // Wire events
  els.btnRefresh?.addEventListener("click", refresh);
  els.breakSelect?.addEventListener("change", refresh);
  els.btnDaily?.addEventListener("click", () => setMode("daily"));
  els.btnWeekly?.addEventListener("click", () => setMode("weekly"));

  // Initial load
  setMode("weekly");
})();
