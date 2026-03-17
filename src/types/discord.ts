export type DiscordStatus = "online" | "dnd" | "idle" | "offline";

export interface DiscordPresence {
  userId: string;
  discordId: string;
  status: DiscordStatus;
  customStatus: string | null;
  lastChanged: string;
}

export interface DiscordPresenceUpdate {
  discordId: string;
  status: DiscordStatus;
  customStatus: string | null;
  timestamp: string;
}

export const DISCORD_STATUS_COLORS: Record<DiscordStatus, string> = {
  online: "#2ecc71",
  dnd: "#e74c3c",
  idle: "#f1c40f",
  offline: "#95a5a6",
};

export const DISCORD_STATUS_LABELS: Record<DiscordStatus, string> = {
  online: "Online",
  dnd: "Do Not Disturb",
  idle: "Idle",
  offline: "Offline",
};
