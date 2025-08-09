/* Forecast Public UI - CoreLord
 * Requests 168h from the API always (matches cache),
 * Daily (24h): show all hourly points + hour tick labels
 * Weekly (7d): show all 168 hourly points, but x-axis only shows day ticks
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

  /**
   * Build (or rebuild) the chart.
   * For weekly, we pass a tickLabelMap so the x-axis only shows day labels.
   */
  function makeChart(labels, series, mode, tickLabelMap /* Map<index,string> or null */) {
    if (!ctx) return;
    if (chart) chart.destroy();

    const css = getComputedStyle(document.documentElement);
    const colWave = css.getPropertyValue("--primary")   || "#58a6ff";
    const colWind = css.getPropertyValue("--secondary") || "#ffa657";
    const colTide = css.getPropertyValue("--accent")    || "#7ee787";

    const isWeekly = mode === "weekly";
    const commonPts = isWeekly
      ? { pointRadius: 0, pointHitRadius: 6 }  // smoother with lots of points
      : { pointRadius: 2, pointHitRadius: 6 };

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
            borderColor: colWave.trim(),
            hidden: !els.chkWave?.checked,
            ...commonPts,
          },
          {
            label: "Wind Speed (kt)",
            data: series.wind,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yWind",
            borderColor: colWind.trim(),
            hidden: !els.chkWind?.checked,
            ...commonPts,
          },
          {
            label: "Tide / Sea level (m)",
            data: series.tide,
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "yTide",
            borderColor: colTide.trim(),
            hidden: !els.chkTide?.checked,
            ...commonPts,
          },
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
              // Show fine-grained time in tooltip for both modes
              title(items) {
                const i = items?.[0]?.dataIndex ?? 0;
                const lbl = labels[i];
                return lbl || "";
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: "#9aa0a6",
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: isWeekly ? 8 : 12,
              callback: function (_value, index) {
                // Weekly: only show a label at day boundaries (from tickLabelMap)
                if (isWeekly) {
                  return tickLabelMap?.get(index) ?? "";
                }
                // Daily: use the hour label we already put in labels[]
                return labels[index] ?? "";
              }
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

  // Build series for the first 24 hours (hourly points)
  function shapeDaily24(items) {
    const take = Math.min(24, items.length);
    const slice = items.slice(0, take);
    return {
      labels: slice.map((i) => tsToLabelHour(i.ts)),
      wave:   slice.map((i) => i.waveHeightM ?? null),
      wind:   slice.map((i) => i.windSpeedKt ?? null),
      tide:   slice.map((i) => i.tideM ?? null),
      tickLabelMap: null, // not used in daily
    };
  }

  /**
   * Weekly: keep ALL hourly points (up to 168),
   * but only show day labels on the x-axis.
   * We compute a map of indices where a new day starts (or the first point),
   * and return that to the axis tick callback.
   */
  function shapeWeeklyContinuous(items) {
    const labels = [];
    const wave = [];
    const wind = [];
    const tide = [];
    const tickLabelMap = new Map(); // index -> "Sat 10"

    let prevDay = null;

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const d = new Date(it.ts * 1000);
      const dayKey = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

      // For the full series we still keep an hour-level label for tooltips.
      labels.push(tsToLabelHour(it.ts));
      wave.push(typeof it.waveHeightM === "number" ? it.waveHeightM : null);
      wind.push(typeof it.windSpeedKt === "number"  ? it.windSpeedKt  : null);
      tide.push(typeof it.tideM === "number"        ? it.tideM        : null);

      // Put a day tick at the first point, and whenever day changes (or local midnight)
      if (idx === 0 || dayKey !== prevDay || d.getHours() === 0) {
        tickLabelMap.set(idx, tsToLabelDay(it.ts));
      }
      prevDay = dayKey;
    }

    return { labels, wave, wind, tide, tickLabelMap };
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
      const shaped = (mode === "daily") ? shapeDaily24(items) : shapeWeeklyContinuous(items);

      makeChart(shaped.labels, shaped, mode, shaped.tickLabelMap || null);
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
