"use client";

import { useEffect, useState } from "react";
import { createSocket } from "../socket";

export default function Home() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [transport, setTransport] = useState<string>("N/A");
  const [socket, setSocket] = useState(createSocket("/checkpoints"));

  useEffect(() => {
    function onConnected() {
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);

      socket.io.engine.on("upgrade", (transport) => {
        setTransport(transport.name);
      });

      socket.onAny((event, ...args) => {
        console.log(`${event}`, args);
      });
    }

    function onDisconnected() {
      setIsConnected(false);
      setTransport("N/A");
    }

    if (socket.connected) {
      onConnected();
    }
    socket.on("connect", onConnected);
    socket.on("disconnect", onDisconnected);

    return () => {
      socket.removeAllListeners();
    };
  }, []);
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <h1>M3U8 Downloader</h1>
      <p>Status: {isConnected ? "connected" : "disconnected"}</p>
      <p>Transport: {transport}</p>
    </div>
  );
}
