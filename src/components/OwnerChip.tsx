"use client";

// Generates a consistent color from a string (so "Maria" always gets the same color)
function hashColor(str: string): string {
  const colors = [
    "#e879a0", "#a78bfa", "#60a5fa", "#34d399",
    "#fbbf24", "#fb923c", "#f472b6", "#38bdf8",
    "#4ade80", "#c084fc", "#fb7185", "#facc15",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Get first letter of nick for the avatar
function getInitial(nick: string): string {
  return nick.charAt(0).toUpperCase();
}

interface OwnerChipProps {
  nick: string;
  size?: "sm" | "md"; // sm = compact inline chip, md = slightly larger
}

export function OwnerChip({ nick, size = "sm" }: OwnerChipProps) {
  const color = hashColor(nick);
  const isSm = size === "sm";

  return (
    <div className="flex items-center gap-1.5 group">
      {/* Circle with initial */}
      <div
        className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white"
        style={{
          width: isSm ? "22px" : "28px",
          height: isSm ? "22px" : "28px",
          fontSize: isSm ? "10px" : "12px",
          backgroundColor: color,
        }}
        title={nick}
      >
        {getInitial(nick)}
      </div>
      {/* Nick label — shows on hover for sm, always visible for md */}
      <span
        className={`text-secondary transition-all duration-150 ${
          isSm ? "opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs overflow-hidden" : ""
        }`}
        style={{ fontSize: isSm ? "11px" : "13px" }}
      >
        {nick}
      </span>
    </div>
  );
}

// Unassigned placeholder — gray dashed circle
export function UnassignedChip() {
  return (
    <div
      className="w-5 h-5 rounded-full border border-dashed flex items-center justify-center"
      style={{ borderColor: "#3a3d4a" }}
      title="Unassigned"
    >
      <span className="text-muted" style={{ fontSize: "10px" }}>?</span>
    </div>
  );
}
