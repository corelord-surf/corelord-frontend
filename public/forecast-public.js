/* Forecast Public UI - CoreLord
 * Pulls breaks from backend and provides Country → Region → Break filters.
 * Summary chart + three detail charts (Wave, Wind, Tide).
 */

(() => {
  const API_URL = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    countrySelect: $("countrySelect"),
    regionSelect: $("regionSelect"),
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

  // ---------- Chart colors ----------
  const ctxSummary = els.canvasSummary?.getContext("2d") ?? null;
  const ctxWave    = els.canvasWave?.getContext("2d") ?? null;
  const ctxWind    = els.canvasWind?.getContext("2d") ?? null;
  const ctxTide    = els.canvasTide?.getContext("2d") ?? null;

  const css = getComputedStyle(document.documentElement);
  const COL_WAVE = (css.getPropertyValue("--primary")   || "#58a6ff").trim();
  const COL_WIND = (css.getPropertyValue("--secondary") || "#ffa657").trim();
  const COL_TIDE = (css.getPropertyValue("--accent")    || "#7ee787").trim();

  // ---------- Breaks + filters ----------
  let allBreaks = [];   // {id,name,region,country,latitude,longitude}
  let summaryChart = null, waveChart = null, windChart = null, tideChart = null;

  function setStatus(text){ if (els.metaInfo) els.metaInfo.textContent = text; }
  function showError(msg){ if (els.errorBox){ els.errorBox.style.display="block"; els.errorBox.textContent = msg; } }
  function clearError(){ if (els.errorBox) els.errorBox.style.display="none"; }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store", credentials: "omit" });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} ${txt || ""}`.trim());
    }
    return res.json();
  }

  async function loadBreaks() {
    allBreaks = await fetchJson(`${API_URL}/api/forecast/breaks`);
    // normalize (backend is already id/name/region/country… but just in case)
    allBreaks = allBreaks.map(b => ({
      id: b.id ?? b.Id,
      name: b.name ?? b.Name,
      region: b.region ?? b.Region ?? "",
      country: b.country ?? b.Country ?? "",
      latitude: b.latitude ?? b.Latitude ?? null,
      longitude: b.longitude ?? b.Longitude ?? null,
    }));

    // Countries
    const countries = Array.from(new Set(allBreaks.map(b => b.country || "Unknown"))).sort();
    fillSelect(els.countrySelect, countries, "(All countries)");
    // Regions for initial country (or all)
    updateRegions();
    // Breaks for initial region(s)
    updateBreaks();
  }

  function fillSelect(sel, values, allLabel) {
    if (!sel) return;
    sel.innerHTML = "";
    if (allLabel) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = allLabel;
      sel.appendChild(o);
    }
    values.forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v || "(Unknown)";
      sel.appendChild(o);
    });
    // if there is at least one non-all option, pick the first real one by default
    if (sel.options.length > 1) sel.value = sel.options[1].value;
  }

  function updateRegions() {
    const c = els.countrySelect?.value || "";
    const regs = Array.from(
      new Set(allBreaks.filter(b => !c || b.country === c).map(b => b.region || ""))
    ).sort();
    fillSelect(els.regionSelect, regs, "(All regions)");
  }

  function updateBreaks() {
    const c = els.countrySelect?.value || "";
    const r = els.regionSelect?.value || "";
    const list = allBreaks
      .filter(b => (!c || b.country === c) && (!r || b.region === r))
      .sort((a,b) => a.name.localeCompare(b.name));

    els.breakSelect.innerHTML = "";
    list.forEach(b => {
      const o = document.createElement("option");
      o.value = String(b.id);
      o.textContent = b.name;
      els.breakSelect.appendChild(o);
    });
    if (!els.breakSelect.value && els.breakSelect.options.length) {
      els.breakSelect.value = els.breakSelect.options[0].value;
    }
  }

  // ---------- Time helpers ----------
  const tsToLabelHour = (sec) => {
    const d = new Date(sec * 1000);
    return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  };
  const tsToHourOnly = (sec) => {
    const d = new Date(sec * 1000);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };
  const tsToLabelDay = (sec) => {
    const d = new Date(sec * 1000);
    return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit" });
  };
  const degToCompass = (deg) => {
    if (typeof deg !== "number" || isNaN(deg)) return "";
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW","N"];
    return dirs[Math.round(((deg % 360)+360)%360 / 22.5)];
  };

  // ---------- Shape data ----------
  function shapeDaily24(items) {
    const take = Math.min(24, items.length);
    const s = items.slice(0, take);
    return packSeries(s, "daily");
  }

  function shapeWeeklyContinuous(items) {
    const shaped = packSeries(items, "weekly");
    const map = new Map();
    let prevKey = null;
    for (let i = 0; i < items.length; i++) {
      const d = new Date(items[i].ts * 1000);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
      if (i === 0 || key !== prevKey || d.getHours() === 0) {
        map.set(i, tsToLabelDay(items[i].ts));
      }
      prevKey = key;
    }
    shaped.tickLabelMap = map;
    return shaped;
  }

  function packSeries(slice, mode) {
    const labels = slice.map(x => mode === "daily" ? tsToHourOnly(x.ts) : tsToLabelHour(x.ts));
    return {
      labels,
      tickLabelMap: null,
      ts: slice.map(x => x.ts),
      wave: slice.map(x => (typeof x.waveHeightM   === "number" ? x.waveHeightM   : null)),
      wind: slice.map(x => (typeof x.windSpeedKt   === "number" ? x.windSpeedKt   : null)),
      tide: slice.map(x => (typeof x.tideM         === "number" ? x.tideM         : null)),
      wavePeriod: slice.map(x => (typeof x.swellPeriodS === "number" ? x.swellPeriodS : null)),
      waveDir:    slice.map(x => (typeof x.swellDir     === "number" ? x.swellDir     : null)),
      windDir:    slice.map(x => (typeof x.windDir      === "number" ? x.windDir      : null)),
    };
  }

  function xAxisConfig(mode, labels, tickLabelMap) {
    const isWeekly = mode === "weekly";
    return {
      ticks: {
        color: "#9aa0a6",
        maxRotation: 0,
        autoSkip: false,
        callback: function (_val, idx) {
          if (isWeekly) return tickLabelMap?.get(idx) ?? "";
          return (idx % 3 === 0) ? (labels[idx] ?? "") : "";
        },
      },
      grid: { color: "rgba(255,255,255,0.05)" },
    };
  }

  // ---------- Charts ----------
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
              title: (items) => {
                const i = items?.[0]?.dataIndex ?? 0;
                return tsToLabelHour(shaped.ts[i]) || "";
              },
              afterBody: (items) => {
                const i = items?.[0]?.dataIndex ?? 0;
                const lines = [];
                if (shaped.wave[i] != null) {
                  const p = shaped.wavePeriod[i];
                  const d = shaped.waveDir[i];
                  if (p != null || d != null) {
                    lines.push(`Swell: ${p != null ? `${p}s` : "—"}${(p!=null && d!=null)?", ":""}${d!=null ? `${degToCompass(d)} (${Math.round(d)}°)` : ""}`);
                  }
                }
                if (shaped.wind[i] != null && shaped.windDir[i] != null) {
                  lines.push(`Wind Dir: ${degToCompass(shaped.windDir[i])} (${Math.round(shaped.windDir[i])}°)`);
                }
                return lines;
              }
            }
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

  function buildWaveDetail(shaped, mode) {
    if (!ctxWave) return;
    waveChart?.destroy();
    const dirTick = (v) => {
      const n = ((v % 360) + 360) % 360;
      const labels = {0:"N",45:"NE",90:"E",135:"SE",180:"S",225:"SW",270:"W",315:"NW",360:"N"};
      return labels[n] ?? "";
    };

    waveChart = new Chart(ctxWave, {
      type: "line",
      data: {
        labels: shaped.labels,
        datasets: [
          { label: "Wave Height (m)", data: shaped.wave, yAxisID: "yWave", borderColor: COL_WAVE, borderWidth: 2, tension: 0.3, pointRadius: mode === "weekly" ? 0 : 2 },
          { label: "Period (s)", data: shaped.wavePeriod, yAxisID: "yPer", borderColor: "#c9cba3", borderDash: [5,3], borderWidth: 2, tension: 0.3, pointRadius: 0 },
          { label: "Direction (°)", data: shaped.waveDir, yAxisID: "yDir", borderColor: "#8ecae6", borderDash: [4,4], borderWidth: 2, tension: 0.3, pointRadius: 0 },
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
              title: (items) => tsToLabelHour(shaped.ts[items[0].dataIndex]) || "",
              afterBody: (items) => {
                const i = items[0].dataIndex;
                const d = shaped.waveDir[i];
                return d != null ? [`Cardinal: ${degToCompass(d)}`] : [];
              },
            },
          },
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yWave: { position: "left", title: { display: true, text: "Wave (m)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,0.05)" } },
          yPer:  { position: "right", title: { display: true, text: "Period (s)" }, ticks: { color: "#9aa0a6" }, grid: { display: false } },
          yDir:  { position: "right", title: { display: true, text: "Direction (°)" }, min: 0, max: 360, ticks: { color: "#9aa0a6", callback: dirTick, stepSize: 45 }, grid: { display: false }, offset: true },
        },
      },
    });
  }

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
              title: (items) => tsToLabelHour(shaped.ts[items[0].dataIndex]) || "",
              afterBody: (items) => {
                const i = items[0].dataIndex;
                const d = shaped.windDir[i];
                return d != null ? [`Cardinal: ${degToCompass(d)}`] : [];
              },
            },
          },
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yWind: { position: "left", title: { display: true, text: "Wind (kt)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,0.05)" }, min: 0 },
          yDir:  { position: "right", title: { display: true, text: "Direction (°)" }, min: 0, max: 360, ticks: { color: "#9aa0a6", callback: dirTick, stepSize: 45 }, grid: { display: false }, offset: true },
        },
      },
    });
  }

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
          tooltip: { callbacks: { title: (items) => tsToLabelHour(shaped.ts[items[0].dataIndex]) || "" } },
        },
        scales: {
          x: xAxisConfig(mode, shaped.labels, shaped.tickLabelMap),
          yTide: { position: "left", title: { display: true, text: "Tide (m)" }, ticks: { color: "#9aa0a6" }, grid: { color: "rgba(255,255,255,0.05)" } },
        },
      },
    });
  }

  // Toggle summary lines
  els.chkWave?.addEventListener("change", () => { if (!summaryChart) return; summaryChart.data.datasets[0].hidden = !els.chkWave.checked; summaryChart.update(); });
  els.chkWind?.addEventListener("change", () => { if (!summaryChart) return; summaryChart.data.datasets[1].hidden = !els.chkWind.checked; summaryChart.update(); });
  els.chkTide?.addEventListener("change", () => { if (!summaryChart) return; summaryChart.data.datasets[2].hidden = !els.chkTide.checked; summaryChart.update(); });

  // ---------- API ----------
  async function loadForecast168(breakId) {
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
    const breakId = parseInt(els.breakSelect?.value || "0", 10);
    if (!breakId) { setStatus("Select a break"); return; }

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
  function setMode(next){
    activeMode = next;
    els.btnDaily?.classList.toggle("active", next === "daily");
    els.btnWeekly?.classList.toggle("active", next === "weekly");
    refresh(activeMode);
  }

  els.btnRefresh?.addEventListener("click", () => refresh(activeMode));
  els.btnDaily?.addEventListener("click", () => setMode("daily"));
  els.btnWeekly?.addEventListener("click", () => setMode("weekly"));

  els.countrySelect?.addEventListener("change", () => { updateRegions(); updateBreaks(); refresh(activeMode); });
  els.regionSelect?.addEventListener("change", () => { updateBreaks(); refresh(activeMode); });
  els.breakSelect?.addEventListener("change", () => refresh(activeMode));

  (async function init(){
    try {
      await loadBreaks();
      setMode("weekly");
    } catch (e) {
      console.error(e);
      showError("Failed to load breaks");
      setStatus("Load failed");
    }
  })();
})();
