"use client";

import { io } from "socket.io-client";

const host = "http://localhost:3001";

export const socket = io(host, {
  transports: ["websocket"],
});

export const createSocket = (namespace: string = "/") => {
  const url = new URL(namespace, host).href;
  return io(url, { transports: ["websocket"] });
};
