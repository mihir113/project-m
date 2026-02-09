"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "⊞" },
  { label: "Tasks", href: "/tasks", icon: "✓" },
  { label: "Projects", href: "/projects", icon: "◎" },
  { label: "Team", href: "/team", icon: "⦿" },
  { label: "Automations", href: "/automations", icon: "⚙" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(true);   // desktop collapse — default collapsed
  const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  // On mount: expand sidebar only if screen is wide enough
  useEffect(() => {
    const expand = () => setCollapsed(window.innerWidth < 1024);
    expand();
    window.addEventListener("resize", expand);
    return () => window.removeEventListener("resize", expand);
  }, []);

  // Hide mobile hamburger on scroll down, show on scroll up
  const [mobileNavHidden, setMobileNavHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollY.current && y > 60) {
        setMobileNavHidden(true);
      } else {
        setMobileNavHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // ── shared nav links renderer ──────────────────────
  const renderLinks = (isMobile: boolean) =>
    NAV_ITEMS.map((item) => {
      const isActive =
        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => { if (isMobile) setMobileOpen(false); }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150"
          style={{
            backgroundColor: isActive ? "rgba(79,111,245,0.12)" : "transparent",
            color: isActive ? "#4f6ff5" : "#9a9eb5",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#1e2130";
              (e.currentTarget as HTMLAnchorElement).style.color = "#f0f1f3";
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLAnchorElement).style.color = "#9a9eb5";
            }
          }}
        >
          <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>
          {/* On desktop: hide label when collapsed. On mobile drawer: always show label */}
          {(isMobile || !collapsed) && (
            <span className="text-sm font-medium">{item.label}</span>
          )}
        </Link>
      );
    });

  // ── logo / brand block ─────────────────────────────
  const renderBrand = (showLabel: boolean) => (
    <Link href="/" className="p-4 flex items-center gap-3 border-b border-default hover:opacity-80 transition-opacity" style={{ textDecoration: "none" }}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "#4f6ff5" }}
      >
        <span className="text-white font-bold text-sm">M</span>
      </div>
      {showLabel && (
        <span className="text-primary font-semibold text-base">Project M</span>
      )}
    </Link>
  );

  // ── MOBILE: hamburger button (always visible on small screens) ──
  const MobileToggle = () => (
    <button
      onClick={() => setMobileOpen(true)}
      className="md:hidden fixed top-4 left-4 z-40 flex items-center justify-center rounded-lg bg-secondary border border-default text-primary"
      style={{
        width: "40px",
        height: "40px",
        transition: "transform 0.3s ease, opacity 0.3s ease",
        transform: mobileNavHidden ? "translateY(-70px)" : "translateY(0)",
        opacity: mobileNavHidden ? 0 : 1,
        pointerEvents: mobileNavHidden ? "none" : "auto",
      }}
      aria-label="Open menu"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <rect x="2" y="4" width="16" height="2" rx="1" />
        <rect x="2" y="9" width="16" height="2" rx="1" />
        <rect x="2" y="14" width="16" height="2" rx="1" />
      </svg>
    </button>
  );

  // ── MOBILE: full-screen overlay drawer ─────────────
  const MobileDrawer = () => (
    <>
      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Drawer panel */}
      <aside
        className="md:hidden fixed top-0 left-0 z-50 flex flex-col h-full bg-secondary transition-transform duration-300"
        style={{
          width: "240px",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Close button + brand */}
        <div className="flex items-center justify-between p-4 border-b border-default">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity" style={{ textDecoration: "none" }}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#4f6ff5" }}
            >
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-primary font-semibold text-base">Project M</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center rounded-lg text-secondary hover:text-primary transition-colors"
            style={{ width: "28px", height: "28px" }}
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {renderLinks(true)}
        </nav>

        {/* Theme toggle (mobile) */}
        <div className="p-3 border-t border-default">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 text-muted hover:text-primary transition-colors py-2"
          >
            <span className="text-lg">{theme === "light" ? "🌙" : "☀️"}</span>
            <span className="text-sm font-medium">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
          </button>
        </div>
      </aside>
    </>
  );

  // ── DESKTOP: static sidebar ────────────────────────
  const DesktopSidebar = () => (
    <aside
      className="hidden md:flex flex-col border-r border-default bg-secondary transition-all duration-300 flex-shrink-0"
      style={{
        width: collapsed ? "64px" : "220px",
        minHeight: "100vh",
      }}
    >
      {renderBrand(!collapsed)}

      <nav className="flex-1 p-2 space-y-1">
        {renderLinks(false)}
      </nav>

      {/* Theme & Collapse toggles */}
      <div className="border-t border-default">
        {/* Theme toggle */}
        <div className="p-3 border-b border-default">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 text-muted hover:text-primary transition-colors py-1"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            <span className="text-lg">{theme === "light" ? "🌙" : "☀️"}</span>
            {!collapsed && <span className="text-sm font-medium">{theme === "light" ? "Dark" : "Light"}</span>}
          </button>
        </div>
        {/* Collapse toggle */}
        <div className="p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center text-muted hover:text-primary transition-colors py-1"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <MobileToggle />
      <MobileDrawer />
      <DesktopSidebar />
    </>
  );
}
