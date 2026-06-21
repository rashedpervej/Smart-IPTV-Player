export interface Channel {
  name: string;
  url: string;
  category: string;
  logo?: string;
  status?: string;
}

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";
