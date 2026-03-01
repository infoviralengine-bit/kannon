/**
 * Video 30-day window logic.
 * Each video has a 30-day window from published_at to accumulate views.
 * After 30 days, views are "frozen" as views_final.
 */

export interface VideoWithWindow {
  views: number | null;
  views_final: number | null;
  window_closed: boolean | null;
  window_expires_at: string | null;
  published_at: string;
  [key: string]: any;
}

/**
 * Returns the effective views for CPM calculation.
 * - window_closed = true → views_final (frozen)
 * - window expired but not yet closed → views (current, treat as final)
 * - window still open → views (provisional)
 * If cap is provided, views are capped per video.
 */
export function getEffectiveViews(video: VideoWithWindow, cap?: number | null): number {
  let views: number;
  if (video.window_closed) {
    views = video.views_final ?? video.views ?? 0;
  } else {
    views = video.views ?? 0;
  }
  if (cap != null && cap > 0) {
    views = Math.min(views, cap);
  }
  return views;
}

/**
 * Sum effective views for a list of videos (for CPM calculation).
 * If cap is provided, each video's views are capped individually.
 */
export function sumEffectiveViewsCapped(videos: VideoWithWindow[], cap?: number | null): number {
  return videos.reduce((sum, v) => sum + getEffectiveViews(v, cap), 0);
}

/**
 * Returns the window status of a video.
 */
export type WindowStatus = "open" | "closing" | "closed";

export function getWindowStatus(video: VideoWithWindow): WindowStatus {
  if (video.window_closed) return "closed";
  if (!video.window_expires_at) return "open";
  const expires = new Date(video.window_expires_at);
  const now = new Date();
  if (expires <= now) return "closed"; // expired but not yet marked
  const hoursLeft = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft <= 24) return "closing";
  return "open";
}

/**
 * Returns days remaining in the window, or 0 if closed.
 */
export function getWindowDaysRemaining(video: VideoWithWindow): number {
  if (video.window_closed) return 0;
  if (!video.window_expires_at) return 30;
  const expires = new Date(video.window_expires_at);
  const now = new Date();
  const diff = expires.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Sum effective views for a list of videos (for CPM calculation).
 */
export function sumEffectiveViews(videos: VideoWithWindow[]): number {
  return videos.reduce((sum, v) => sum + getEffectiveViews(v), 0);
}

/**
 * Count videos by window status.
 */
export function countByWindowStatus(videos: VideoWithWindow[]): { open: number; closed: number } {
  let open = 0, closed = 0;
  videos.forEach(v => {
    const status = getWindowStatus(v);
    if (status === "closed") closed++;
    else open++;
  });
  return { open, closed };
}
