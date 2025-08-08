/* Forecast Public UI - CoreLord (no hours input)
 * IDs expected in the HTML:
 *   #breakSelect, #btnRefresh, #btnHourly, #btnDaily,
 *   #chkWave, #chkWind, #chkTide, #metaInfo, #forecastChart, #errorBox
 */

(() => {
  const API_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";
  const HOURS = 168; // fixed: we always fetch a week; "Daily" just aggregates

  // Breaks menu
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
    btnHourly: $("btnHourly"),
    btnDaily: $("btnDaily"),
    chkWave: $("chkWave"),
    chkWind: $("chkWind"),
    chkTide: $("chkTide"),
    metaInfo: $("metaInfo"),
    canvas: $("forecastChart"),
    errorBox: $("errorBox"),
  };

  const required = ["breakSelect","btnRefresh","btnHourly","btnDaily","metaInfo","canvas"];
  for (const key of required) {
    if (!els[key]) console.error(`[forecast-public] Missing required element: #${key}`);
  }

  // Populate dropdown once
  if (els.breakSelect && !els.breakSelect.options.length) {
    for (const b of BREAKS) {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = b.name;
      els.breakSelect.appendChild(opt);
    }
  }

  // ---- Chart ----
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
            pointRadius: 2,
            tension: 0.3,
            yAxisID: "yWave",
            borderColor: "#58a6ff",
            backgroundColor: "rgba(88,166,255,.2)",
            hidden: !boolOr(els.chkWave, true),
          },
          {
            label: "Wind Speed (kt)",
            data: series.wind,
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            yAxisID: "yWind",
            borderColor: "#ffa657",
            backgroundColor: "rgba(255,166,87,.2)",
            hidden: !boolOr(els.chkWind, true),
          },
          {
            label: "Tide / Sea level (m)",
            data: series.tide,
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            yAxisID: "yTide",
            borderColor: "#7ee787",
            backgroundColor: "rgba(126,231,135,.2)",
            hidden: !boolOr(els.chkTide, true),
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
            ticks: { color: "#9aa0a6", maxRotation: 0, autoSkip: true },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
          yWave: {
            position: "left",
            title: { display: true, text: "Wave (m)" },
            ticks: { color: "#9aa0a6" },
            grid: { color: "rgba(88,166,255,0.12)" },
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

  // Toggle handlers
  function hookToggle(el, datasetIndex) {
    if (!el) return;
    el.addEventListener("change", () => {
      if (!chart) return;
      chart.setDatasetVisibility(datasetIndex, el.checked);
      chart.update();
    });
  }
  hookToggle(els.chkWave, 0);
  hookToggle(els.chkWind, 1);
  hookToggle(els.chkTide, 2);

  // ---- Helpers ----
  const boolOr = (el, def) => (el && typeof el.checked === "boolean" ? el.checked : def);

  function setStatus(text) {
    if (els.metaInfo) els.metaInfo.textContent = text;
  }
  function setError(show, text) {
    if (!els.errorBox) return;
    els.errorBox.style.display = show ? "block" : "none";
    if (text) els.errorBox.textContent = text;
  }

  const tsToLabel = (sec) =>
    new Date(sec * 1000).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  // Build hourly series from API payload
  function shapeHourly(data) {
    const items = Array.isArray(data?.items) ? data.items : [];
    return {
      labels: items.map(i => tsToLabel(i.ts)),
      wave:   items.map(i => i.waveHeightM ?? null),
      wind:   items.map(i => i.windSpeedKt ?? null),
      tide:   items.map(i => i.tideM ?? null),
    };
  }

  // Aggregate to daily: wave/wind = max of day; tide = daily average
  function groupDaily(items) {
    const byDay = new Map();
    for (const it of (items || [])) {
      const key = new Date(it.ts * 1000).toISOString().slice(0, 10); // YYYY-MM-DD UTC
      let row = byDay.get(key);
      if (!row) { row = { wave: [], wind: [], tide: [] }; byDay.set(key, row); }
      if (typeof it.waveHeightM === "number") row.wave.push(it.waveHeightM);
      if (typeof it.windSpeedKt  === "number") row.wind.push(it.windSpeedKt);
      if (typeof it.tideM        === "number") row.tide.push(it.tideM);
    }
    const labels = [];
    const wave = [];
    const wind = [];
    const tide = [];
    for (const [day, v] of byDay.entries()) {
      labels.push(day);
      wave.push(v.wave.length ? Math.max(...v.wave) : null);
      wind.push(v.wind.length ? Math.max(...v.wind) : null);
      tide.push(v.tide.length ? avg(v.tide) : null);
    }
    return { labels, wave, wind, tide };
  }

  // ---- Data fetch ----
  async function loadForecast(breakId) {
    const url = `${API_URL}/api/forecast/timeseries?breakId=${breakId}&hours=${HOURS}`;
    console.log("[forecast] GET", url);
    const t0 = performance.now();

    const res = await fetch(url, { cache: "no-store" });
    const txt = await res.text();
    const ms = Math.round(performance.now() - t0);

    if (!res.ok) {
      console.error("[forecast] HTTP", res.status, txt.slice(0, 200));
      throw new Error(`HTTP ${res.status}`);
    }

    let data;
    try { data = JSON.parse(txt); }
    catch (e) { console.error("[forecast] Bad JSON:", txt.slice(0, 200)); throw e; }

    console.log("[forecast] ok in", ms, "ms | items:", data?.items?.length ?? 0);
    return { data, ms };
  }

  // ---- Render ----
  let activeMode = "hourly"; // 'hourly' | 'daily'

  async function refresh() {
    const breakId = parseInt(els.breakSelect?.value || "15", 10);
    setError(false);
    setStatus("Loading…");

    try {
      const { data, ms } = await loadForecast(breakId);
      const name = data?.break?.name || data?.break?.Name || `#${breakId}`;
      setStatus(`${name} • ${data?.hours ?? "?"}h • fromCache: ${data?.fromCache ? "yes" : "no"} • ${ms}ms`);

      const hourly = shapeHourly(data);
      const daily  = groupDaily(data.items);
      const series = activeMode === "daily" ? daily : hourly;

      makeChart(series.labels, series);
    } catch (e) {
      console.error("[forecast] FAIL", e);
      setStatus(`Load failed: ${e.message}`);
      setError(true, "Failed to load forecast data.");
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets.forEach(d => (d.data = []));
        chart.update();
      }
    }
  }

  function setMode(next) {
    activeMode = next;
    els.btnHourly?.classList.toggle("active", next === "hourly");
    els.btnDaily?.classList.toggle("active", next === "daily");
    refresh();
  }

  // ---- Events ----
  els.btnRefresh?.addEventListener("click", refresh);
  els.breakSelect?.addEventListener("change", refresh);
  els.btnHourly?.addEventListener("click", () => setMode("hourly"));
  els.btnDaily?.addEventListener("click", () => setMode("daily"));

  // Initial render
  setMode("hourly");
})();
