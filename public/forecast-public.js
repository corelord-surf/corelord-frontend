/* Forecast Public UI - CoreLord
 * Safe, debuggable version with verbose logs.
 * Expects the following element IDs in forecast-public.html:
 * #breakSelect, #hoursInput, #btnRefresh, #btnHourly, #btnDaily,
 * #chkWave, #chkWind, #chkTide, #metaInfo, #forecastChart
 */

(() => {
  const API_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";

  // If you want to add/remove breaks, do it here.
  const BREAKS = [
    { id: 15, name: "Ribeira D'ilhas" },
    { id: 2,  name: "Cave" },
    { id: 3,  name: "Coxos" },
    { id: 37, name: "Point Impossible" },
    { id: 43, name: "Steps" },
    { id: 46, name: "Torquay Point" },
  ];

  // ---- Grab DOM ----
  const $ = (id) => document.getElementById(id);
  const els = {
    breakSelect: $("breakSelect"),
    hoursInput: $("hoursInput"),
    btnRefresh: $("btnRefresh"),
    btnHourly: $("btnHourly"),
    btnDaily: $("btnDaily"),
    chkWave: $("chkWave"),
    chkWind: $("chkWind"),
    chkTide: $("chkTide"),
    metaInfo: $("metaInfo"),
    canvas: $("forecastChart"),
  };

  // Fallbacks if page doesn’t have every checkbox
  const boolOr = (el, def) => (el && typeof el.checked === "boolean" ? el.checked : def);

  // Make sure we fail loudly if required controls aren’t there
  const required = ["breakSelect", "hoursInput", "btnRefresh", "btnHourly", "btnDaily", "metaInfo", "canvas"];
  for (const key of required) {
    if (!els[key]) {
      console.error(`[forecast-public] Missing required element: #${key}`);
    }
  }

  // Populate break select (only if empty)
  if (els.breakSelect && !els.breakSelect.options.length) {
    for (const b of BREAKS) {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = b.name;
      els.breakSelect.appendChild(opt);
    }
  }

  // ---- Chart setup ----
  let chart = null;
  const ctx = els.canvas ? els.canvas.getContext("2d") : null;

  function makeChart(labels, series) {
    if (!ctx) return;
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Wave Height (m)",
            data: series.wave,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yWave",
            hidden: !boolOr(els.chkWave, true),
          },
          {
            label: "Wind Speed (kt)",
            data: series.wind,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yWind",
            hidden: !boolOr(els.chkWind, true),
          },
          {
            label: "Tide / Sea level (m)",
            data: series.tide,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yTide",
            hidden: !boolOr(els.chkTide, true),
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#ccc" } },
          tooltip: { callbacks: {} },
        },
        scales: {
          x: {
            ticks: { color: "#9aa0a6", maxRotation: 0, autoSkip: true },
            grid: { color: "rgba(255,255,255,0.05)" },
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

  // Toggle visibility handlers (if checkboxes exist)
  for (const [idx, key] of [["chkWave",0], ["chkWind",1], ["chkTide",2]]) {
    const el = els[key];
    if (el && typeof el.addEventListener === "function") {
      el.addEventListener("change", () => {
        if (!chart) return;
        chart.setDatasetVisibility(idx, el.checked);
        chart.update();
      });
    }
  }

  // ---- Helpers ----
  const tsToLabel = (sec) => {
    const d = new Date(sec * 1000);
    // short local label: "Fri 04:00"
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  function groupDaily(items) {
    // returns { labels: [...dates], wave:[max], wind:[max], tide:[avg] }
    const byDay = new Map();
    for (const it of items) {
      const d = new Date(it.ts * 1000);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      let row = byDay.get(key);
      if (!row) {
        row = { wave: [], wind: [], tide: [] };
        byDay.set(key, row);
      }
      if (typeof it.waveHeightM === "number") row.wave.push(it.waveHeightM);
      if (typeof it.windSpeedKt === "number") row.wind.push(it.windSpeedKt);
      if (typeof it.tideM === "number") row.tide.push(it.tideM);
    }
    const labels = [];
    const wave = [];
    const wind = [];
    const tide = [];
    [...byDay.entries()].forEach(([day, v]) => {
      labels.push(day);
      wave.push(v.wave.length ? Math.max(...v.wave) : null);
      wind.push(v.wind.length ? Math.max(...v.wind) : null);
      tide.push(v.tide.length ? avg(v.tide) : null);
    });
    return { labels, wave, wind, tide };
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  function setStatus(text) {
    if (els.metaInfo) els.metaInfo.textContent = text;
  }

  // ---- Networking ----
  async function loadForecast({ breakId, hours }) {
    const url = `${API_URL}/api/forecast/timeseries?breakId=${breakId}&hours=${hours}&includeTide=1`;
    console.log("[forecast] GET", url);
    const t0 = performance.now();
    try {
      const res = await fetch(url, { cache: "no-store" });
      const txt = await res.text();
      const ms = Math.round(performance.now() - t0);

      if (!res.ok) {
        console.error("[forecast] HTTP", res.status, txt.slice(0, 200));
        throw new Error(`HTTP ${res.status}`);
      }

      let data;
      try {
        data = JSON.parse(txt);
      } catch (e) {
        console.error("[forecast] Bad JSON:", txt.slice(0, 200));
        throw e;
      }

      console.log("[forecast] ok in", ms, "ms",
        "| items:", data?.items?.length ?? 0,
        "| break:", data?.break?.name || data?.break?.Name || breakId
      );

      return { data, ms, url };
    } catch (err) {
      console.error("[forecast] FAIL", err);
      throw err;
    }
  }

  function shapeHourly(data) {
    const items = Array.isArray(data?.items) ? data.items : [];
    const labels = items.map((i) => tsToLabel(i.ts));
    const wave = items.map((i) => i.waveHeightM ?? null);
    const wind = items.map((i) => i.windSpeedKt ?? null);
    const tide = items.map((i) => i.tideM ?? null);
    return { labels, wave, wind, tide };
  }

  async function refresh(mode /* 'hourly' | 'daily' */) {
    const breakId = parseInt(els.breakSelect?.value || "15", 10);
    const hours = parseInt(els.hoursInput?.value || "168", 10);

    setStatus("Loading...");
    try {
      const { data, ms, url } = await loadForecast({ breakId, hours });

      // Fill top status
      const name = data?.break?.name || data?.break?.Name || `#${breakId}`;
      setStatus(`${name} • ${data?.hours ?? "?"}h • fromCache: ${data?.fromCache ? "yes" : "no"} • ${ms}ms`);

      // Build chart data
      const hourly = shapeHourly(data);
      const series = mode === "daily" ? groupDaily(data.items) : hourly;

      // Wire chart
      makeChart(series.labels, series);

      // Log a small preview row
      console.log("[forecast] first row:", data.items?.[0] ?? "(none)");
      console.log("[forecast] request:", url);
    } catch (e) {
      setStatus(`Load failed: ${e.message}`);
      // Clear chart if present
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets.forEach(d => d.data = []);
        chart.update();
      }
    }
  }

  // ---- Events ----
  els.btnRefresh?.addEventListener("click", () => refresh(activeMode));
  els.breakSelect?.addEventListener("change", () => refresh(activeMode));
  els.hoursInput?.addEventListener("change", () => refresh(activeMode));

  let activeMode = "hourly";
  function setMode(next) {
    activeMode = next;
    // chip styles, if present
    if (els.btnHourly) els.btnHourly.classList.toggle("active", next === "hourly");
    if (els.btnDaily) els.btnDaily.classList.toggle("active", next === "daily");
    refresh(activeMode);
  }
  els.btnHourly?.addEventListener("click", () => setMode("hourly"));
  els.btnDaily?.addEventListener("click", () => setMode("daily"));

  // Initial draw
  setMode("hourly");
})();
