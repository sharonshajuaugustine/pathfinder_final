import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Hash an IP (or any identifier) for privacy-preserving storage. Never store raw IPs.
export async function hashIdentifier(value: string): Promise<string> {
  const data = new TextEncoder().encode(value + (process.env.HASH_SALT ?? "career-guidance"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}
