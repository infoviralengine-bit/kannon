import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rimuove il prefisso @ iniziale dallo username, se presente */
export function cleanUsername(username: string | null | undefined): string {
  if (!username) return "";
  return username.replace(/^@+/, "");
}
