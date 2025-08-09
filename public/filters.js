// public/filters.js
// Renders Country, Region, Break selects and exposes window.CoreLordFilters
// Depends on: /api/forecast/breaks

(() => {
  const BACKEND_BASE = "https://corelord-backend-etgpd9dfdufragfb.westeurope-01.azurewebsites.net";
  const STORAGE_KEY = "corelord.selection";

  const state = {
    data: [],           // [{id,name,region,latitude,longitude,country?}]
    map: null,          // { country -> { region -> [breaks] } }
    selection: { country: "", region: "", breakId: "" },
    listeners: new Set()
  };

  function $(q, el = document) { return el.querySelector(q); }
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n.setAttribute(k, v);
    });
    children.forEach(c => n.appendChild(c));
    return n;
  }

  function loadPersisted() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (s && typeof s === "object") state.selection = { country: s.country || "", region: s.region || "", breakId: s.breakId || "" };
    } catch {}
  }
  function savePersisted() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selection));
  }

  async function fetchBreaks() {
    const res = await fetch(`${BACKEND_BASE}/api/forecast/breaks`, { credentials: "omit" });
    if (!res.ok) throw new Error(`GET /breaks ${res.status}`);
    const arr = await res.json();
    state.data = Array.isArray(arr) ? arr : [];
  }

  function buildMap() {
    const UNKNOWN = "Unknown";
    const map = {};
    for (const b of state.data) {
      const country = b.country || UNKNOWN;
      const region = b.region || UNKNOWN;
      if (!map[country]) map[country] = {};
      if (!map[country][region]) map[country][region] = [];
      map[country][region].push({ id: b.id, name: b.name, region, country });
    }
    // sort for nicer UX
    for (const c of Object.keys(map)) {
      for (const r of Object.keys(map[c])) {
        map[c][r].sort((a, b) => a.name.localeCompare(b.name));
      }
    }
    state.map = map;
  }

  function fireChange() {
    savePersisted();
    for (const fn of state.listeners) {
      try { fn(getSelection()); } catch {}
    }
  }

  function getSelection() {
    const sel = { ...state.selection };
    const byId = findBreakById(sel.breakId);
    if (byId) {
      sel.breakName = byId.name;
      sel.region = byId.region;
      sel.country = byId.country || sel.country || "Unknown";
    }
    return sel;
  }

  function findBreakById(id) {
    const num = Number(id);
    if (!Number.isFinite(num)) return null;
    return state.data.find(b => b.id === num) || null;
    }

  function renderInto(container) {
    const root = el("div", { class: "cl-filters" }, [
      el("label", { for: "clCountry", class: "cl-label", text: "Country" }),
      el("select", { id: "clCountry", class: "cl-select" }),
      el("label", { for: "clRegion", class: "cl-label", text: "Region" }),
      el("select", { id: "clRegion", class: "cl-select" }),
      el("label", { for: "clBreak", class: "cl-label", text: "Break" }),
      el("select", { id: "clBreak", class: "cl-select" }),
    ]);

    container.innerHTML = "";
    container.appendChild(root);

    const countrySel = $("#clCountry", root);
    const regionSel  = $("#clRegion", root);
    const breakSel   = $("#clBreak", root);

    function fillCountries() {
      countrySel.innerHTML = "";
      const countries = Object.keys(state.map).sort();
      for (const c of countries) {
        const opt = el("option", { value: c, text: c });
        if (c === state.selection.country) opt.selected = true;
        countrySel.appendChild(opt);
      }
      if (!state.selection.country && countries.length) state.selection.country = countries[0];
    }

    function fillRegions() {
      regionSel.innerHTML = "";
      const regions = Object.keys(state.map[state.selection.country] || {}).sort();
      for (const r of regions) {
        const opt = el("option", { value: r, text: r });
        if (r === state.selection.region) opt.selected = true;
        regionSel.appendChild(opt);
      }
      if (!state.selection.region && regions.length) state.selection.region = regions[0];
    }

    function fillBreaks() {
      breakSel.innerHTML = "";
      const list = (state.map[state.selection.country] || {})[state.selection.region] || [];
      for (const b of list) {
        const opt = el("option", { value: String(b.id), text: b.name });
        if (String(b.id) === String(state.selection.breakId)) opt.selected = true;
        breakSel.appendChild(opt);
      }
      if (!state.selection.breakId && list.length) state.selection.breakId = String(list[0].id);
    }

    fillCountries();
    fillRegions();
    fillBreaks();

    countrySel.addEventListener("change", () => {
      state.selection.country = countrySel.value;
      state.selection.region = "";
      state.selection.breakId = "";
      fillRegions();
      fillBreaks();
      fireChange();
    });
    regionSel.addEventListener("change", () => {
      state.selection.region = regionSel.value;
      state.selection.breakId = "";
      fillBreaks();
      fireChange();
    });
    breakSel.addEventListener("change", () => {
      state.selection.breakId = breakSel.value;
      fireChange();
    });

    // announce initial
    fireChange();
  }

  async function boot() {
    // attach point(s)
    const nodes = Array.from(document.querySelectorAll("[data-cl-filters]"));
    if (!nodes.length) return;

    loadPersisted();
    await fetchBreaks();
    buildMap();
    nodes.forEach(renderInto);
  }

  // small public API
  window.CoreLordFilters = {
    onChange(fn) { state.listeners.add(fn); },
    offChange(fn) { state.listeners.delete(fn); },
    getSelection
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
