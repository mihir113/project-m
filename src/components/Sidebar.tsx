"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "⊞" },
  { label: "Projects", href: "/projects", icon: "◎" },
  { label: "Team", href: "/team", icon: "⦿" },
  { label: "Templates", href: "/templates", icon: "◈" },
  { label: "Reports", href: "/reports", icon: "📊" },
  { label: "AI Assistant", href: "/ai", icon: "✦" },
  { label: "Import", href: "/import", icon: "↓" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col border-r border-default transition-all duration-300 flex-shrink-0"
      style={{
        width: collapsed ? "64px" : "220px",
        backgroundColor: "#171923",
        minHeight: "100vh",
      }}
    >
      {/* Logo / Brand */}
      <div className="p-4 flex items-center gap-3 border-b border-default">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "#4f6ff5" }}
        >
          <span className="text-white font-bold text-sm">M</span>
        </div>
        {!collapsed && (
          <span className="text-primary font-semibold text-base">Project M</span>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
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
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle at the bottom */}
      <div className="p-3 border-t border-default">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center text-muted hover:text-primary transition-colors py-1"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>
    </aside>
  );
}
