/* Forecast Public UI - CoreLord
 * Summary chart + three detail charts (Wave, Wind, Tide)
 * Daily (24h): all hourly points with hour ticks
 * Weekly (7d): all 168 hourly points, show day ticks only
 */
(() => {
  const API_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";

  const BREAKS = [
    { id: 15, name: "Ribeira D'ilhas" },
    { id: 2,  name: "Cave" },
    { id: 3,  name: "Coxos" },
    { id: 37, name: "Point Impossible" },
    { id: 43, name: "Steps" },
    { id: 46, name: "Torquay Point" },
  ];

  // ---------- DOM ----------
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
    canvasSummary: $("forecastChart"),
    canvasWave: $("waveChart"),
    canvasWind: $("windChart"),
    canvasTide: $("tideChart"),
    errorBox: $("errorBox"),
  };

  if (els.breakSelect && !els.breakSelect.options.length) {
    for (const b of BREAKS) {
      const opt = document.createElement("option");
      opt.value = String(b.id);
      opt.textContent = b.name;
      els.breakSelect.appendChild(opt);
    }
  }

  // ---------- Charts ----------
  let summaryChart = null, waveChart = null, windChart = null, tideChart = null;

  const ctxSummary = els.canvasSummary?.getContext("2d") ?? null;
  const ctxWave    = els.canvasWave?.getContext("2d") ?? null;
  const ctxWind    = els.canvasWind?.getContext("2d") ?? null;
  const ctxTide    = els.canvasTide?.getContext("2d") ?? null;

  const css = getComputedStyle(document.documentElement);
  const COL_WAVE   = (css.getPropertyValue("--primary")   || "#58a6ff").trim();
  const COL_WIND   = (css.getPropertyValue("--secondary") || "#ffa657").trim();
  const COL_TIDE   = (css.getPropertyValue("--accent")    || "#7ee787").trim();
  const COL_PERIOD = "#b392f0";

  // ---------- Helpers ----------
  const tsToLabelHour = (sec) =>
    new Date(sec * 1000).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

  const tsToLabelDay = (sec) =>
    new Date(sec * 1000).toLocaleDateString(undefined, { weekday: "short", day: "2-digit" });

  const degToCompass = (deg) => {
    if (typeof deg !== "number" || isNaN(deg)) return "";
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    const ix = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
    return dirs[ix];
  };

  // Pack arrays used across all charts
  function packSeries(slice) {
    return {
      labels: slice.map(x => tsToLabelHour(x.ts)),
      tickLabelMap: null, // weekly fills this
      ts:    slice.map(x => x.ts),
      wave:  slice.map(x => (typeof x.waveHeightM === "number" ? x.waveHeightM : null)),
      wind:  slice.map(x => (typeof x.windSpeedKt === "number" ? x.windSpeedKt : null)),
      tide:  slice.map(x => (typeof x.tideM       === "number" ? x.tideM       : null)),
      period:   slice.map(x => (typeof x.swellPeriodS === "number" ? x.swellPeriodS : null)),
      swellDir: slice.map(x => (typeof x.swellDir     === "number" ? x.swellDir     : null)),
      windDir:  slice.map(x => (typeof x.windDir      === "number" ? x.windDir      : null)),
    };
  }

  function shapeDaily24(items) {
    const take = Math.min(24, items.length);
    return packSeries(items.slice(0, take));
  }

  function shapeWeeklyContinuous(items) {
    const shaped = packSeries(items);
    const map = new Map();
    let prevKey = null;
    for (let i = 0; i < items.length; i++) {
      const d = new Date(items[i].ts * 1000);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
      if (i === 0 || key !== prevKey || d.getUTCHours() === 0) {
        map.set(i, tsToLabelDay(items[i].ts));
      }
      prevKey = key;
    }
    shaped.tickLabelMap = map;
    return shaped;
  }

  function xAxisConfig(mode, labels, tickLabelMap) {
    const isWeekly = mode === "weekly";
    return {
      ticks: {
        color: "#9aa0a6",
        maxRotation: 0,
        autoSkip: false,
        callback: (_val, idx) =>
          isWeekly ? (tickLabelMap?.get(idx) ?? "") : (labels[idx] ?? ""),
      },
      grid: { color: "rgba(255,255,255,0.05)" },
    };
  }

  // ---------- Summary ----------
  function buildSummary(shaped, mode) {
    if (!ctxSummary) return;
    summaryChart?.destroy();

    const isWeekly = mode === "weekly";
    const pts = isWeekly ? { pointRadius: 0, pointHitRadius: 6 } : { pointRadius: 2, pointHitRadius: 6 };

    summaryChart = new Chart(ctxSummary, {
      type: "line",
      data: {
        labels: shaped.labels,
        datasets: [
          { label: "Wave Height (m)", data: shaped.wave, yAxisID: "yWave", borderColor: COL_WAVE, borderWidth: 2, tension: 0.3, hidden: !els.chkWave?.checked, ...pts },
          { label: "Wind Speed (kt)", data: shaped.wind, yAxisID: "yWind", borderColor: COL_WIND, borderWidth: 2, tension: 0.3, hidden: !els.chkWind?.checked, ...pts },
          { label: "Tide / Sea level (m)", data: shaped.tide, yAxisID: "yTide", borderColor: COL_TIDE, borderWidth: 2, tension: 0.3, hidden: !els.chkTide?.checked, ...pts },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#c9d1d9" } },
          tooltip: {
            callbacks: {
              title: (items)=> shaped.labels[items?.[0]?.dataIndex ?? 0] || "",
              afterBody: (items) => {
                const i = items?.[0]?.dataIndex ?? 0;
                const lines = [];
                if (shaped.period[i]   != null) lines.push(`Swell Period: ${shaped.period[i]}s`);
                if (shaped.swellDir[i] != null) lines.push(`Swell Dir: ${Math.round(shaped.swellDir[i])}° (${degToCompass(shaped.swellDir[i])})`);
                if (shaped.windDir[i]  != null) lines.push(`Wind Dir: ${Math.round(shaped.windDir[i])}° (${degToCompass(shaped.windDir[i])})`);
                return lines;
              }
            }
          }
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yWave: { position: "left",  title: { display: true, text: "Wave (m)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(88,166,255,0.15)" } },
          yWind: { position: "right", title: { display: true, text: "Wind (kt)" }, ticks: { color: "#9aa0a6" }, grid: { display: false }, min: 0 },
          yTide: { position: "right", title: { display: true, text: "Tide (m)" }, ticks: { color: "#9aa0a6" }, grid: { display: false } },
        },
      },
    });
  }

  // ---------- Wave detail ----------
  function buildWaveDetail(shaped, mode) {
    if (!ctxWave) return;
    waveChart?.destroy();
    const pts = mode === "weekly" ? 0 : 2;

    waveChart = new Chart(ctxWave, {
      type: "line",
      data: {
        labels: shaped.labels,
        datasets: [
          { label: "Wave Height (m)",   data: shaped.wave,   yAxisID: "yWave", borderColor: COL_WAVE,   borderWidth: 2, tension: 0.3, pointRadius: pts },
          { label: "Swell Period (s)",  data: shaped.period, yAxisID: "yPer",  borderColor: COL_PERIOD, borderWidth: 2, tension: 0.3, pointRadius: 0, borderDash: [4,3] },
        ],
      },
      options: {
        responsive: true, animation: false, interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#c9d1d9" } },
          tooltip: {
            callbacks: {
              title: (items)=> shaped.labels[items?.[0]?.dataIndex ?? 0] || "",
              afterBody: (items)=> {
                const i = items?.[0]?.dataIndex ?? 0;
                return (shaped.swellDir[i] != null)
                  ? [`Swell Dir: ${Math.round(shaped.swellDir[i])}° (${degToCompass(shaped.swellDir[i])})`]
                  : [];
              }
            }
          }
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yWave: { position: "left",  title: { display: true, text: "Wave (m)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,0.05)" } },
          yPer:  { position: "right", title: { display: true, text: "Period (s)" }, ticks: { color: "#9aa0a6" }, grid: { display: false }, min: 0 },
        },
      },
    });
  }

  // ---------- Wind detail ----------
  function buildWindDetail(shaped, mode) {
    if (!ctxWind) return;
    windChart?.destroy();
    const pts = mode === "weekly" ? 0 : 2;

    const dirTick = (v) => {
      const n = ((v % 360) + 360) % 360;
      const map = {0:"N",45:"NE",90:"E",135:"SE",180:"S",225:"SW",270:"W",315:"NW",360:"N"};
      return map[n] ?? "";
    };

    windChart = new Chart(ctxWind, {
      type: "line",
      data: {
        labels: shaped.labels,
        datasets: [
          { label: "Wind Speed (kt)", data: shaped.wind,   yAxisID: "yWind", borderColor: COL_WIND, borderWidth: 2, tension: 0.3, pointRadius: pts },
          { label: "Direction (°)",   data: shaped.windDir, yAxisID: "yDir",  borderColor: "#a3c4f3", borderWidth: 2, tension: 0.3, pointRadius: 0, borderDash: [4,3] },
        ],
      },
      options: {
        responsive: true, animation: false, interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#c9d1d9" } },
          tooltip: {
            callbacks: {
              title: (items)=> shaped.labels[items?.[0]?.dataIndex ?? 0] || "",
              afterBody: (items)=> {
                const i = items?.[0]?.dataIndex ?? 0;
                return (shaped.windDir[i] != null) ? [`Cardinal: ${degToCompass(shaped.windDir[i])}`] : [];
              }
            }
          }
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yWind: { position: "left",  title: { display: true, text: "Wind (kt)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,0.05)" }, min: 0 },
          yDir:  { position: "right", title: { display: true, text: "Direction (°)" }, min: 0, max: 360, ticks: { color: "#9aa0a6", callback: dirTick, stepSize: 45 }, grid: { display: false } },
        },
      },
    });
  }

  // ---------- Tide detail ----------
  function buildTideDetail(shaped, mode) {
    if (!ctxTide) return;
    tideChart?.destroy();
    const pts = mode === "weekly" ? 0 : 2;

    tideChart = new Chart(ctxTide, {
      type: "line",
      data: {
        labels: shaped.labels,
        datasets: [
          { label: "Tide / Sea level (m)", data: shaped.tide, yAxisID: "yTide", borderColor: COL_TIDE, borderWidth: 2, tension: 0.3, pointRadius: pts },
        ],
      },
      options: {
        responsive: true, animation: false, interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: "#c9d1d9" } } },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yTide: { position: "left", title: { display: true, text: "Tide (m)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,0.05)" } },
        },
      },
    });
  }

  // Checkboxes affect only the summary chart
  els.chkWave?.addEventListener("change", () => { if (!summaryChart) return; summaryChart.data.datasets[0].hidden = !els.chkWave.checked; summaryChart.update(); });
  els.chkWind?.addEventListener("change", () => { if (!summaryChart) return; summaryChart.data.datasets[1].hidden = !els.chkWind.checked; summaryChart.update(); });
  els.chkTide?.addEventListener("change", () => { if (!summaryChart) return; summaryChart.data.datasets[2].hidden = !els.chkTide.checked; summaryChart.update(); });

  function setStatus(t){ els.metaInfo && (els.metaInfo.textContent = t); }
  function showError(m){ if (els.errorBox){ els.errorBox.style.display="block"; els.errorBox.textContent=m; } }
  function clearError(){ if (els.errorBox){ els.errorBox.style.display="none"; } }

  // ---------- API ----------
  async function loadForecast168(breakId) {
    // NOTE: no includeTide flag — backend is cache-only
    const url = `${API_URL}/api/forecast/timeseries?breakId=${breakId}&hours=168`;
    const t0 = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    const txt = await res.text();
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = JSON.parse(txt);
    return { data, ms };
  }

  async function refresh(mode) {
    const breakId = parseInt(els.breakSelect?.value || "15", 10);
    clearError(); setStatus("Loading...");
    try {
      const { data, ms } = await loadForecast168(breakId);
      const name = data?.break?.name || data?.break?.Name || `#${breakId}`;
      setStatus(`${name} • ${data?.hours ?? "?"}h • fromCache: ${data?.fromCache ? "yes" : "no"} • ${ms}ms`);

      const items = Array.isArray(data?.items) ? data.items : [];
      const shaped = mode === "daily" ? shapeDaily24(items) : shapeWeeklyContinuous(items);

      buildSummary(shaped, mode);
      buildWaveDetail(shaped, mode);
      buildWindDetail(shaped, mode);
      buildTideDetail(shaped, mode);
    } catch (e) {
      setStatus("Load failed");
      showError(e.message || String(e));
      [summaryChart, waveChart, windChart, tideChart].forEach(ch => {
        if (ch) { ch.data.labels = []; ch.data.datasets.forEach(d => d.data = []); ch.update(); }
      });
    }
  }

  // ---------- Events & initial ----------
  let activeMode = "weekly";
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

  setMode("weekly");
})();
