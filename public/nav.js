// Inject a left sidebar navigation into any page that includes this file.
// Highlights the active link based on the current location.

(function () {
  const links = [
    { href: "/dashboard.html",     text: "Dashboard",     match: p => p === "/dashboard.html" },
    { href: "/profile.html",       text: "Profile",       match: p => p === "/profile.html" },
    // Treat any planner path as active for this link
    { href: "/planner-setup.html", text: "Planner Setup", match: p => p.startsWith("/planner") },
    { href: "/preferences.html",   text: "Preferences",   match: p => p === "/preferences.html" },
    { href: "/availability.html",  text: "Availability",  match: p => p === "/availability.html" }
  ];

  const hideOn = ["/index.html", "/"]; // do not render on splash
  const norm = (p) => {
    try {
      // pathname only, lower case, strip trailing slash
      let s = (p || location.pathname).toLowerCase().replace(/\/+$/, "");
      // normalise index
      if (s === "") s = "/";
      if (s.endsWith("/index.html")) s = s.slice(0, -"/index.html".length) || "/";
      // if no extension and not root, assume .html
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

      // Build nav shell
      const nav = document.createElement("nav");
      nav.id = "cl-nav-root";
      nav.innerHTML = `
        <div id="cl-nav-brand">CoreLord</div>
        <ul id="cl-nav-links"></ul>
        <div id="cl-nav-footer">Signed in required for most pages</div>
      `;
      document.body.appendChild(nav);

      // Layout wrapper so we do not edit each page
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

      // Render links and set active
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
