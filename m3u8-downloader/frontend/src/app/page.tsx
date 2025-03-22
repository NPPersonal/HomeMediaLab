"use client";

import useCheckpoints from "@/hooks/download-checkpoints";

export default function Home() {
  const { checkpoints, socketInfo } = useCheckpoints();
  console.log(checkpoints);
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <h1>M3U8 Downloader</h1>
      <p>Status: {socketInfo.isConnected ? "connected" : "disconnected"}</p>
      <p>Transport: {socketInfo.transport}</p>
    </div>
  );
}
