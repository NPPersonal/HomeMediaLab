import React from "react";
import M3U8Manager from "@/components/m3u8-manager/m3u8-manager";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "HLS Downloader",
  description: "Download HLS video",
};

export default function Home() {
  return (
    <div className="flex justify-center">
      <M3U8Manager />
    </div>
  );
}
