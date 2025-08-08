/* Public Forecast UI
 * - Always fetches 168h from API (matches our cache), then:
 *   - Daily (24h): slice next 24 hours, plot hourly.
 *   - Weekly (7d): aggregate 168h into 7 daily points.
 */

(() => {
  const API_URL =
    "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";

  // Surf breaks shown in the dropdown
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
    btnRefresh:  $("btnRefresh"),
    btnDaily:    $("btnDaily"),
    btnWeekly:   $("btnWeekly"),
    metaInfo:    $("metaInfo"),
    canvas:      $("forecastChart"),
    errorBox:    $("errorBox"),
    chkWave:     $("chkWave"),
    chkWind:     $("chkWind"),
    chkTide:     $("chkTide"),
  };

  // Populate select once
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
  const ctx = els.canvas?.getContext("2d");

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
            hidden: !els.chkWave?.checked,
          },
          {
            label: "Wind Speed (kt)",
            data: series.wind,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yWind",
            hidden: !els.chkWind?.checked,
          },
          {
            label: "Tide / Sea level (m)",
            data: series.tide,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yTide",
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
        },
        scales: {
          x: {
            ticks: {
              color: "#9aa0a6",
              autoSkip: mode === "weekly" ? false : true,
              maxRotation: 0,
              callback: (val, idx, ticks) => {
                const lbl = labels[idx];
                return mode === "weekly" ? lbl /* 'Fri 08' etc. */ : lbl;
              },
            },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
          yWave: {
            position: "left",
            title: { display: true, text: "Wave (m)" },
            ticks: { color: "#9aa0a6" },
            grid: { color: "rgba(88,166,255,0.14)" },
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

  // Toggle dataset visibility live
  function hookToggle(el, index) {
    if (!el) return;
    el.addEventListener("change", () => {
      if (!chart) return;
      chart.setDatasetVisibility(index, el.checked);
      chart.update();
    });
  }
  hookToggle(els.chkWave, 0);
  hookToggle(els.chkWind, 1);
  hookToggle(els.chkTide, 2);

  // ---- Helpers ----
  const nowSec = () => Math.floor(Date.now() / 1000);
  const fmtHour = (sec) =>
    new Date(sec * 1000).toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtDay = (sec) =>
    new Date(sec * 1000).toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
    });
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  function setStatus(text, error = false) {
    if (els.metaInfo) els.metaInfo.textContent = text;
    if (els.errorBox) els.errorBox.style.display = error ? "block" : "none";
  }

  // ---- Networking ----
  async function load168h(breakId) {
    const url = `${API_URL}/api/forecast/timeseries?breakId=${breakId}&hours=168&includeTide=1`;
    const t0 = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    const ms = Math.round(performance.now() - t0);

    if (!res.ok) {
      console.error("[forecast] HTTP", res.status, text.slice(0, 200));
      throw new Error(`HTTP ${res.status}`);
    }
    let data;
    try { data = JSON.parse(text); } catch (e) {
      console.error("[forecast] Bad JSON:", text.slice(0, 200));
      throw e;
    }
    return { data, ms, url };
  }

  // Shape for 24h hourly
  function shapeDaily24(items) {
    const end = nowSec() + 24 * 3600;
    const subset = items.filter((i) => i.ts <= end);
    return {
      labels: subset.map((i) => fmtHour(i.ts)),
      wave:   subset.map((i) => i.waveHeightM ?? null),
      wind:   subset.map((i) => i.windSpeedKt ?? null),
      tide:   subset.map((i) => i.tideM ?? null),
    };
  }

  // Aggregate into 7 daily points (max wave, max wind, avg tide)
  function shapeWeekly(items) {
    const byDay = new Map(); // key = local YYYY-MM-DD
    for (const i of items) {
      const d = new Date(i.ts * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      let row = byDay.get(key);
      if (!row) { row = { ts: i.ts, wave: [], wind: [], tide: [] }; byDay.set(key, row); }
      if (typeof i.waveHeightM  === "number") row.wave.push(i.waveHeightM);
      if (typeof i.windSpeedKt  === "number") row.wind.push(i.windSpeedKt);
      if (typeof i.tideM        === "number") row.tide.push(i.tideM);
      // keep earliest ts for label
      if (i.ts < row.ts) row.ts = i.ts;
    }
    // sort by ts and take first 7
    const days = [...byDay.values()].sort((a,b)=>a.ts-b.ts).slice(0,7);
    return {
      labels: days.map(d => fmtDay(d.ts)),
      wave:   days.map(d => d.wave.length ? Math.max(...d.wave) : null),
      wind:   days.map(d => d.wind.length ? Math.max(...d.wind) : null),
      tide:   days.map(d => avg(d.tide)),
    };
  }

  // ---- Main refresh ----
  let mode = "weekly"; // default
  function setMode(next) {
    mode = next;
    els.btnDaily?.classList.toggle("active",  next === "daily");
    els.btnWeekly?.classList.toggle("active", next === "weekly");
    refresh();
  }

  async function refresh() {
    const breakId = parseInt(els.breakSelect?.value || "15", 10);
    setStatus("Loading...", false);

    try {
      const { data, ms } = await load168h(breakId);
      const name = data?.break?.name || data?.break?.Name || `#${breakId}`;
      setStatus(`${name} • ${data?.hours ?? "?"}h • fromCache: ${data?.fromCache ? "yes" : "no"} • ${ms}ms`, false);

      const items = Array.isArray(data?.items) ? data.items : [];
      const shaped = mode === "daily" ? shapeDaily24(items) : shapeWeekly(items);
      makeChart(shaped.labels, { wave: shaped.wave, wind: shaped.wind, tide: shaped.tide }, mode);
    } catch (e) {
      setStatus(`Load failed: ${e.message}`, true);
      if (chart) { chart.data.labels = []; chart.data.datasets.forEach(d=>d.data=[]); chart.update(); }
    }
  }

  // Events
  els.btnRefresh?.addEventListener("click", refresh);
  els.breakSelect?.addEventListener("change", refresh);
  els.btnDaily?.addEventListener("click",  () => setMode("daily"));
  els.btnWeekly?.addEventListener("click", () => setMode("weekly"));

  // init
  setMode("weekly");
})();
