/* Public Forecast UI - CoreLord
 * Modes:
 *  - "daily":   24 hours (hourly points)
 *  - "weekly":  168 hours (aggregated: max wave/wind, avg tide)
 */

(() => {
  const API_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";

  // Breaks shown in the selector
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

  // Populate the break select
  if (els.breakSelect && !els.breakSelect.options.length) {
    for (const b of BREAKS) {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = b.name;
      els.breakSelect.appendChild(opt);
    }
  }

  // Chart.js setup
  let chart = null;
  const ctx = els.canvas.getContext("2d");

  function makeChart(labels, series, mode) {
    // readable x-axis: few ticks, autoskip, mode-specific formatting
    const isWeekly = mode === "weekly";
    const xTicks = {
      color: "#9aa0a6",
      autoSkip: true,
      maxTicksLimit: isWeekly ? 7 : 8,  // fewer ticks for weekly
      callback: (val, idx) => {
        // labels[idx] is either "EEE HH:mm" (daily) or "YYYY-MM-DD" (weekly)
        const raw = labels[idx] ?? "";
        if (isWeekly) {
          // show "Mon 12" from YYYY-MM-DD
          const [y, m, d] = raw.split("-");
          const dt = new Date(`${raw}T12:00:00Z`);
          return dt.toLocaleDateString(undefined, { weekday: "short", day: "2-digit" });
        }
        // daily
        return raw; // "EEE HH:mm"
      },
    };

    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Wave Height (m)",
            data: series.wave,
            borderColor: "#58a6ff",
            backgroundColor: "rgba(88,166,255,0.15)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yWave",
            hidden: !els.chkWave.checked,
          },
          {
            label: "Wind Speed (kt)",
            data: series.wind,
            borderColor: "#ffa657",
            backgroundColor: "rgba(255,166,87,0.15)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yWind",
            hidden: !els.chkWind.checked,
          },
          {
            label: "Tide / Sea level (m)",
            data: series.tide,
            borderColor: "#7ee787",
            backgroundColor: "rgba(126,231,135,0.15)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yTide",
            hidden: !els.chkTide.checked,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#e6edf3" } },
          tooltip: {
            callbacks: {
              title: (items) => {
                const label = items?.[0]?.label ?? "";
                if (isWeekly) {
                  const dt = new Date(`${label}T12:00:00Z`);
                  return dt.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
                }
                return label; // already pretty
              },
            },
          },
        },
        scales: {
          x: {
            ticks: xTicks,
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

  // Toggle visibility changes
  [els.chkWave, els.chkWind, els.chkTide].forEach((el, idx) => {
    el.addEventListener("change", () => {
      if (!chart) return;
      chart.setDatasetVisibility(idx, el.checked);
      chart.update();
    });
  });

  // Helpers
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  const tsToShort = (sec) => {
    const d = new Date(sec * 1000);
    return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }); // "Mon 04:00"
  };

  function shapeHourly(items) {
    const labels = items.map(i => tsToShort(i.ts));
    return {
      labels,
      wave: items.map(i => i.waveHeightM ?? null),
      wind: items.map(i => i.windSpeedKt ?? null),
      tide: items.map(i => i.tideM ?? null),
    };
  }

  function shapeDailyAggregate(items) {
    // map YYYY-MM-DD -> arrays then aggregate
    const buckets = new Map();
    for (const it of items) {
      const iso = new Date(it.ts * 1000).toISOString().slice(0, 10);
      let row = buckets.get(iso);
      if (!row) {
        row = { wave: [], wind: [], tide: [] };
        buckets.set(iso, row);
      }
      if (typeof it.waveHeightM === "number") row.wave.push(it.waveHeightM);
      if (typeof it.windSpeedKt === "number") row.wind.push(it.windSpeedKt);
      if (typeof it.tideM === "number") row.tide.push(it.tideM);
    }
    const labels = [];
    const wave = [];
    const wind = [];
    const tide = [];
    for (const [day, v] of buckets.entries()) {
      labels.push(day);
      wave.push(v.wave.length ? Math.max(...v.wave) : null);
      wind.push(v.wind.length ? Math.max(...v.wind) : null);
      tide.push(v.tide.length ? avg(v.tide) : null);
    }
    return { labels, wave, wind, tide };
  }

  function setStatus(text) {
    els.metaInfo.textContent = text;
  }

  async function loadForecast(breakId, hours) {
    const url = `${API_URL}/api/forecast/timeseries?breakId=${breakId}&hours=${hours}&includeTide=1`;
    const t0 = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    const txt = await res.text();
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) {
      console.error("[forecast] HTTP", res.status, txt.slice(0, 200));
      throw new Error(`HTTP ${res.status}`);
    }
    let data;
    try { data = JSON.parse(txt); } catch (e) { console.error("Bad JSON:", txt); throw e; }
    return { data, ms };
  }

  async function refresh(mode) {
    const breakId = parseInt(els.breakSelect.value || "15", 10);
    const hours = mode === "daily" ? 24 : 168;

    els.errorBox.style.display = "none";
    setStatus("Loading...");
    try {
      const { data, ms } = await loadForecast(breakId, hours);
      const name = data?.break?.name || data?.break?.Name || `#${breakId}`;
      setStatus(`${name} • ${data?.hours ?? "?"}h • fromCache: ${data?.fromCache ? "yes" : "no"} • ${ms}ms`);

      const items = Array.isArray(data?.items) ? data.items : [];
      const shaped = mode === "daily" ? shapeHourly(items) : shapeDailyAggregate(items);
      makeChart(shaped.labels, shaped, mode);

      // keep the checkboxes‘ visibility in sync after rebuild
      chart.setDatasetVisibility(0, els.chkWave.checked);
      chart.setDatasetVisibility(1, els.chkWind.checked);
      chart.setDatasetVisibility(2, els.chkTide.checked);
      chart.update();
    } catch (e) {
      setStatus(`Load failed: ${e.message}`);
      els.errorBox.style.display = "block";
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets.forEach(d => d.data = []);
        chart.update();
      }
    }
  }

  // Events
  els.btnRefresh.addEventListener("click", () => refresh(activeMode));
  els.breakSelect.addEventListener("change", () => refresh(activeMode));

  let activeMode = "weekly"; // default landing mode
  function setMode(next) {
    activeMode = next;
    els.btnDaily.classList.toggle("active", next === "daily");
    els.btnWeekly.classList.toggle("active", next === "weekly");
    refresh(activeMode);
  }
  els.btnDaily.addEventListener("click", () => setMode("daily"));
  els.btnWeekly.addEventListener("click", () => setMode("weekly"));

  // Initial draw
  setMode(activeMode);
})();
