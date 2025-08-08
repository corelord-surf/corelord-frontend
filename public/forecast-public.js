/* Forecast Public UI - CoreLord
 * Requests 168h from the API always (matches cache),
 * then renders either Daily (first 24h) or Weekly (7 days aggregated).
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

  function makeChart(labels, series, mode) {
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
            borderColor: getComputedStyle(document.documentElement).getPropertyValue("--primary") || "#58a6ff",
            pointRadius: 2,
            hidden: !els.chkWave?.checked,
          },
          {
            label: "Wind Speed (kt)",
            data: series.wind,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yWind",
            borderColor: getComputedStyle(document.documentElement).getPropertyValue("--secondary") || "#ffa657",
            pointRadius: 2,
            hidden: !els.chkWind?.checked,
          },
          {
            label: "Tide / Sea level (m)",
            data: series.tide,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yTide",
            borderColor: getComputedStyle(document.documentElement).getPropertyValue("--accent") || "#7ee787",
            pointRadius: 2,
            hidden: !els.chkTide?.checked,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#c9d1d9" } },
          tooltip: {},
        },
        scales: {
          x: {
            ticks: {
              color: "#9aa0a6",
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: mode === "daily" ? 10 : 7, // keep x labels readable
            },
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

  // Checkbox toggles
  els.chkWave?.addEventListener("change", () => { if (!chart) return; chart.data.datasets[0].hidden = !els.chkWave.checked; chart.update(); });
  els.chkWind?.addEventListener("change", () => { if (!chart) return; chart.data.datasets[1].hidden = !els.chkWind.checked; chart.update(); });
  els.chkTide?.addEventListener("change", () => { if (!chart) return; chart.data.datasets[2].hidden = !els.chkTide.checked; chart.update(); });

  // ---- Helpers ----
  const tsToLabelHour = (sec) => {
    const d = new Date(sec * 1000);
    return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  };
  const tsToLabelDay = (sec) => {
    const d = new Date(sec * 1000);
    return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit" });
  };
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  // Build series for the first 24 hours
  function shapeDaily24(items) {
    const take = Math.min(24, items.length);
    const slice = items.slice(0, take);
    return {
      labels: slice.map((i) => tsToLabelHour(i.ts)),
      wave: slice.map((i) => i.waveHeightM ?? null),
      wind: slice.map((i) => i.windSpeedKt ?? null),
      tide: slice.map((i) => i.tideM ?? null),
    };
  }

  // Aggregate into 7 daily buckets (max wave/wind, avg tide)
  function shapeWeekly(items) {
    // group by UTC day
    const byDay = new Map();
    for (const it of items) {
      const dayKey = new Date(it.ts * 1000).toISOString().slice(0, 10);
      let row = byDay.get(dayKey);
      if (!row) { row = { ts: it.ts, wave: [], wind: [], tide: [] }; byDay.set(dayKey, row); }
      row.ts = Math.min(row.ts, it.ts);
      if (typeof it.waveHeightM === "number") row.wave.push(it.waveHeightM);
      if (typeof it.windSpeedKt === "number") row.wind.push(it.windSpeedKt);
      if (typeof it.tideM === "number") row.tide.push(it.tideM);
    }
    // sort by earliest timestamp & take first 7
    const days = [...byDay.values()].sort((a, b) => a.ts - b.ts).slice(0, 7);

    return {
      labels: days.map((d) => tsToLabelDay(d.ts)),
      wave: days.map((d) => d.wave.length ? Math.max(...d.wave) : null),
      wind: days.map((d) => d.wind.length ? Math.max(...d.wind) : null),
      tide: days.map((d) => d.tide.length ? avg(d.tide) : null),
    };
  }

  function setStatus(text) {
    if (els.metaInfo) els.metaInfo.textContent = text;
  }

  function showError(msg) {
    if (!els.errorBox) return;
    els.errorBox.style.display = "block";
    els.errorBox.textContent = msg;
  }
  function clearError() {
    if (!els.errorBox) return;
    els.errorBox.style.display = "none";
  }

  // ---- Networking ----
  async function loadForecast168(breakId) {
    const url = `${API_URL}/api/forecast/timeseries?breakId=${breakId}&hours=168&includeTide=1`;
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
    console.log("[forecast] ok in", ms, "ms", "| items:", data?.items?.length ?? 0);
    return { data, ms };
  }

  async function refresh(mode /* 'daily' | 'weekly' */) {
    const breakId = parseInt(els.breakSelect?.value || "15", 10);

    clearError();
    setStatus("Loading...");
    try {
      const { data, ms } = await loadForecast168(breakId);

      const name = data?.break?.name || data?.break?.Name || `#${breakId}`;
      setStatus(`${name} • ${data?.hours ?? "?"}h • fromCache: ${data?.fromCache ? "yes" : "no"} • ${ms}ms`);

      const items = Array.isArray(data?.items) ? data.items : [];
      const series = mode === "daily" ? shapeDaily24(items) : shapeWeekly(items);

      makeChart(series.labels, series, mode);
    } catch (e) {
      setStatus("Load failed");
      showError(e.message || String(e));
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets.forEach(d => d.data = []);
        chart.update();
      }
    }
  }

  // ---- Events & initial mode ----
  let activeMode = "weekly"; // default to weekly
  function setMode(next) {
    activeMode = next;
    els.btnDaily?.classList.toggle("active", next === "daily");
    els.btnWeekly?.classList.toggle("active", next === "weekly");
    refresh(activeMode);
  }

  els.btnRefresh?.addEventListener("click", () => refresh(activeMode));
  els.breakSelect?.addEventListener("change", () => refresh(activeMode));
  els.btnDaily?.addEventListener("click", () => setMode("daily"));
  els.btnWeekly?.addEventListener("click", () => setMode("weekly"));

  // Initial draw
  setMode("weekly");
})();
