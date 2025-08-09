/* Forecast Public UI - CoreLord
 * Summary chart + three detail charts (Wave, Wind, Tide)
 * Daily (24h): show all hourly points, label every 3 hours (readable)
 * Weekly (7d): show all 168 hourly points, label only day ticks
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
  let summaryChart = null;
  let waveChart = null;
  let windChart = null;
  let tideChart = null;

  const ctxSummary = els.canvasSummary?.getContext("2d") ?? null;
  const ctxWave    = els.canvasWave?.getContext("2d") ?? null;
  const ctxWind    = els.canvasWind?.getContext("2d") ?? null;
  const ctxTide    = els.canvasTide?.getContext("2d") ?? null;

  const css = getComputedStyle(document.documentElement);
  const COL_WAVE = (css.getPropertyValue("--primary")   || "#58a6ff").trim();
  const COL_WIND = (css.getPropertyValue("--secondary") || "#ffa657").trim();
  const COL_TIDE = (css.getPropertyValue("--accent")    || "#7ee787").trim();

  // ---------- Helpers ----------
  const tsToLabelHour = (sec) => {
    const d = new Date(sec * 1000);
    return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  };
  const tsToLabelDay = (sec) => {
    const d = new Date(sec * 1000);
    return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit" });
  };
  const degToCompass = (deg) => {
    if (typeof deg !== "number" || isNaN(deg)) return "";
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW","N"];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5)];
  };

  // Build 24h shaped series (hourly points) + readable tick map (every 3h)
  function shapeDaily24(items) {
    const take = Math.min(24, items.length);
    const slice = items.slice(0, take);
    const shaped = packSeries(slice);

    const map = new Map(); // index -> label
    for (let i = 0; i < slice.length; i++) {
      const d = new Date(slice[i].ts * 1000);
      // show at 00:00 and then every 3 hours
      if (i === 0 || d.getHours() % 3 === 0) {
        const dayPrefix = d.getHours() === 0 ? tsToLabelDay(slice[i].ts) + " " : "";
        const hh = String(d.getHours()).padStart(2, "0");
        map.set(i, `${dayPrefix}${hh}:00`);
      }
    }
    shaped.tickLabelMap = map;
    return shaped;
  }

  // Weekly: keep ALL hourly points (up to 168), show day ticks only
  function shapeWeeklyContinuous(items) {
    const shaped = packSeries(items);
    const map = new Map();
    let prevKey = null;
    for (let i = 0; i < items.length; i++) {
      const d = new Date(items[i].ts * 1000);
      const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
      if (i === 0 || key !== prevKey || d.getHours() === 0) {
        map.set(i, tsToLabelDay(items[i].ts));
      }
      prevKey = key;
    }
    shaped.tickLabelMap = map;
    return shaped;
  }

  // Pack arrays used across all charts (labels for tooltip, plus metrics)
  function packSeries(slice) {
    return {
      labels: slice.map(x => tsToLabelHour(x.ts)),
      tickLabelMap: null, // filled per mode
      ts:    slice.map(x => x.ts),
      wave:  slice.map(x => (typeof x.waveHeightM   === "number" ? x.waveHeightM   : null)),
      wind:  slice.map(x => (typeof x.windSpeedKt   === "number" ? x.windSpeedKt   : null)),
      tide:  slice.map(x => (typeof x.tideM         === "number" ? x.tideM         : null)),
      // extras
      wavePeriod: slice.map(x => (typeof x.wavePeriodS      === "number" ? x.wavePeriodS      : null)),
      waveDir:    slice.map(x => (typeof x.waveDirectionDeg === "number" ? x.waveDirectionDeg : null)),
      windDir:    slice.map(x => (typeof x.windDirectionDeg === "number" ? x.windDirectionDeg : null)),
    };
  }

  function xAxisConfig(mode, labels, tickLabelMap) {
    const isWeekly = mode === "weekly";
    return {
      ticks: {
        color: "#b4bcc6",
        maxRotation: 0,
        autoSkip: true,
        autoSkipPadding: 12,
        // show at our mapped indices only (both daily & weekly)
        callback: function (_val, idx) {
          return tickLabelMap?.get(idx) ?? "";
        },
        font: ctx => ({ size: 12 }),
      },
      grid: { color: "rgba(255,255,255,0.05)" },
    };
  }

  // ---------- Summary chart ----------
  function buildSummary(shaped, mode) {
    if (!ctxSummary) return;
    summaryChart?.destroy();

    const isWeekly = mode === "weekly";
    const commonPts = isWeekly ? { pointRadius: 0, pointHitRadius: 6 } : { pointRadius: 2, pointHitRadius: 6 };

    summaryChart = new Chart(ctxSummary, {
      type: "line",
      data: {
        labels: shaped.labels,
        datasets: [
          { label: "Wave Height (m)", data: shaped.wave, yAxisID: "yWave", borderColor: COL_WAVE, borderWidth: 2, tension: 0.3, hidden: !els.chkWave?.checked, ...commonPts },
          { label: "Wind Speed (kt)", data: shaped.wind, yAxisID: "yWind", borderColor: COL_WIND, borderWidth: 2, tension: 0.3, hidden: !els.chkWind?.checked, ...commonPts },
          { label: "Tide / Sea level (m)", data: shaped.tide, yAxisID: "yTide", borderColor: COL_TIDE, borderWidth: 2, tension: 0.3, hidden: !els.chkTide?.checked, ...commonPts },
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
              title(items) {
                const i = items?.[0]?.dataIndex ?? 0;
                return shaped.labels[i] || "";
              },
              afterBody(items) {
                const i = items?.[0]?.dataIndex ?? 0;
                const lines = [];
                if (shaped.wave[i] != null) {
                  const p = shaped.wavePeriod[i];
                  const d = shaped.waveDir[i];
                  if (p != null || d != null) {
                    lines.push(`Swell Period: ${p != null ? `${p.toFixed(1)}s` : "—"}`);
                    if (d != null) lines.push(`Swell Dir: ${degToCompass(d)} (${Math.round(d)}°)`);
                  }
                }
                if (shaped.wind[i] != null) {
                  const wd = shaped.windDir[i];
                  if (wd != null) lines.push(`Wind Dir: ${degToCompass(wd)} (${Math.round(wd)}°)`);
                }
                return lines;
              },
            },
          },
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yWave: { position: "left", title: { display: true, text: "Wave (m)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(88,166,255,0.15)" } },
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

    waveChart = new Chart(ctxWave, {
      type: "line",
      data: {
        labels: shaped.labels,
        datasets: [
          { label: "Wave Height (m)", data: shaped.wave, yAxisID: "yWave", borderColor: COL_WAVE, borderWidth: 2, tension: 0.3, pointRadius: mode === "weekly" ? 0 : 2 },
          { label: "Period (s)", data: shaped.wavePeriod, yAxisID: "yPer", borderColor: "#c9cba3", borderDash: [4,3], borderWidth: 2, tension: 0.3, pointRadius: 0 },
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
              title: (items) => shaped.labels[items[0].dataIndex] || "",
              afterBody(items) {
                const i = items?.[0]?.dataIndex ?? 0;
                const d = shaped.waveDir[i];
                return d != null ? [`Direction: ${degToCompass(d)} (${Math.round(d)}°)`] : [];
              },
            },
          },
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yWave: { position: "left", title: { display: true, text: "Wave (m)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,0.05)" } },
          yPer:  { position: "right", title: { display: true, text: "Period (s)" }, ticks: { color: "#9aa0a6" }, grid: { display: false } },
        },
      },
    });
  }

  // ---------- Wind detail ----------
  function buildWindDetail(shaped, mode) {
    if (!ctxWind) return;
    windChart?.destroy();

    const dirTick = (v) => {
      const n = ((v % 360) + 360) % 360;
      const labels = {0:"N",45:"NE",90:"E",135:"SE",180:"S",225:"SW",270:"W",315:"NW",360:"N"};
      return labels[n] ?? "";
    };

    windChart = new Chart(ctxWind, {
      type: "line",
      data: {
        labels: shaped.labels,
        datasets: [
          { label: "Wind Speed (kt)", data: shaped.wind, yAxisID: "yWind", borderColor: COL_WIND, borderWidth: 2, tension: 0.3, pointRadius: mode === "weekly" ? 0 : 2 },
          { label: "Direction (°)", data: shaped.windDir, yAxisID: "yDir", borderColor: "#a3c4f3", borderDash: [4,3], borderWidth: 2, tension: 0.3, pointRadius: 0 },
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
              title: (items) => shaped.labels[items[0].dataIndex] || "",
              afterBody(items) {
                const i = items?.[0]?.dataIndex ?? 0;
                const d = shaped.windDir[i];
                return d != null ? [`Cardinal: ${degToCompass(d)}`] : [];
              },
            },
          },
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yWind: { position: "left", title: { display: true, text: "Wind (kt)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,0.05)" }, min: 0 },
          yDir:  { position: "right", title: { display: true, text: "Direction (°)" }, min: 0, max: 360, ticks: { color: "#9aa0a6", callback: dirTick, stepSize: 45 }, grid: { display: false } },
        },
      },
    });
  }

  // ---------- Tide detail ----------
  function buildTideDetail(shaped, mode) {
    if (!ctxTide) return;
    tideChart?.destroy();

    tideChart = new Chart(ctxTide, {
      type: "line",
      data: {
        labels: shaped.labels,
        datasets: [
          { label: "Tide / Sea level (m)", data: shaped.tide, yAxisID: "yTide", borderColor: COL_TIDE, borderWidth: 2, tension: 0.3, pointRadius: mode === "weekly" ? 0 : 2 },
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
              title: (items) => shaped.labels[items[0].dataIndex] || "",
            },
          },
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yTide: { position: "left", title: { display: true, text: "Tide (m)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,0.05)" } },
        },
      },
    });
  }

  // Checkbox toggles affect only the summary chart
  els.chkWave?.addEventListener("change", () => { if (!summaryChart) return; summaryChart.data.datasets[0].hidden = !els.chkWave.checked; summaryChart.update(); });
  els.chkWind?.addEventListener("change", () => { if (!summaryChart) return; summaryChart.data.datasets[1].hidden = !els.chkWind.checked; summaryChart.update(); });
  els.chkTide?.addEventListener("change", () => { if (!summaryChart) return; summaryChart.data.datasets[2].hidden = !els.chkTide.checked; summaryChart.update(); });

  function setStatus(text) { if (els.metaInfo) els.metaInfo.textContent = text; }
  function showError(msg) { if (els.errorBox) { els.errorBox.style.display = "block"; els.errorBox.textContent = msg; } }
  function clearError()   { if (els.errorBox) els.errorBox.style.display = "none"; }

  // ---------- API ----------
  async function loadForecast168(breakId) {
    const url = `${API_URL}/api/forecast/timeseries?breakId=${breakId}&hours=168&includeTide=1`;
    const t0 = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    const txt = await res.text();
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let data; try { data = JSON.parse(txt); } catch (e) { throw e; }
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
      const shaped = (mode === "daily") ? shapeDaily24(items) : shapeWeeklyContinuous(items);

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
