"use client";

import { DiscordStatus } from "@/types/discord";

interface BadgeProps {
  status: DiscordStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const statusConfig: Record<
  DiscordStatus,
  { color: string; bg: string; label: string }
> = {
  online: {
    color: "bg-green-500",
    bg: "bg-green-500/10 border-green-500/30",
    label: "Online",
  },
  dnd: {
    color: "bg-red-500",
    bg: "bg-red-500/10 border-red-500/30",
    label: "DND",
  },
  idle: {
    color: "bg-yellow-500",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    label: "Idle",
  },
  offline: {
    color: "bg-gray-500",
    bg: "bg-gray-500/10 border-gray-500/30",
    label: "Offline",
  },
};

export function Badge({ status, showLabel = true, size = "md" }: BadgeProps) {
  const config = statusConfig[status];
  const dotSize = size === "sm" ? "w-2 h-2" : "w-3 h-3";
  const textSize = size === "sm" ? "text-[6px]" : "text-[8px]";

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-1
        border rounded-none font-pixel ${textSize}
        ${config.bg} text-pixel-text
      `}
    >
      <span className={`${dotSize} rounded-full ${config.color}`} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
