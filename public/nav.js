(function () {
  const links = [
    { href: "/dashboard.html",     text: "Dashboard",       match: p => p === "/dashboard.html" },
    { href: "/profile.html",       text: "Profile",         match: p => p === "/profile.html" },
    { href: "/planner-setup.html", text: "Planner Setup",   match: p => p.startsWith("/planner") },
    { href: "/preferences.html",   text: "Preferences",     match: p => p === "/preferences.html" },
    { href: "/availability.html",  text: "Availability",    match: p => p === "/availability.html" },
    { href: "/forecast-debug.html",text: "Forecast",        match: p => p === "/forecast-debug.html" }
  ];

  const hideOn = ["/index.html", "/"];
  const norm = (p) => {
    try {
      let s = (p || location.pathname).toLowerCase().replace(/\/+$/, "");
      if (s === "") s = "/";
      if (s.endsWith("/index.html")) s = s.slice(0, -"/index.html".length) || "/";
      if (!s.endsWith(".html") && s !== "/") s = s + ".html";
      return s;
    } catch {
      return location.pathname.toLowerCase();
    }
  };

  const current = norm(location.pathname);
  if (hideOn.includes(current)) return;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      document.body.classList.add("cl-with-nav");

      const nav = document.createElement("nav");
      nav.id = "cl-nav-root";
      nav.innerHTML = `
        <div id="cl-nav-brand">CoreLord</div>
        <ul id="cl-nav-links"></ul>
        <div id="cl-nav-footer">Signed in required for most pages</div>
      `;
      document.body.appendChild(nav);

      const layout = document.createElement("div");
      layout.id = "cl-nav-layout";

      const spacer = document.createElement("div");
      spacer.id = "cl-nav-spacer";

      const content = document.createElement("div");
      content.id = "cl-nav-content";

      const children = Array.from(document.body.children).filter(el => el !== nav);
      children.forEach(el => content.appendChild(el));

      layout.appendChild(spacer);
      layout.appendChild(content);
      document.body.appendChild(layout);

      const list = document.getElementById("cl-nav-links");
      links.forEach(l => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = l.href;
        a.textContent = l.text;

        if (l.match(norm(location.pathname))) {
          a.classList.add("active");
        }

        li.appendChild(a);
        list.appendChild(li);
      });
    } catch (e) {
      console.error("cl nav failed", e);
    }
  });
})();
