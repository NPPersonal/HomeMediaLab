import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const urlRegex = new RegExp(/^https?:\/\//);
export function isUrl(url: string) {
  return urlRegex.test(url);
}

const m3u8Regex = new RegExp(/^https?:\/\/.*.m3u8/);
export function isM3U8Url(url: string) {
  return m3u8Regex.test(url);
}
