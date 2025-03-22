/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { io, Socket } from "socket.io-client";

const host = "http://localhost:3001";

// let socket: Socket | undefined = undefined;
// let socketNameSpace: string | undefined = undefined;
const sockets: Array<{ socket: Socket; namespace: string }> = [];

export const createSocket = (
  namespace: string = "/",
  onConnect?: undefined | (() => void),
  onDisconnect?: undefined | (() => void)
) => {
  // Return socket if it is exists otherwise invalidate the current one
  const found = sockets.find((value) => {
    return value.namespace === namespace;
  });
  if (found) {
    return found.socket;
  }

  // Create a new socket
  const url = new URL(namespace, host).href;
  const newSocket = io(url, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
  });
  if (onConnect) newSocket.on("connect", onConnect);
  if (onDisconnect) newSocket.on("disconnect", onDisconnect);
  sockets.push({ socket: newSocket, namespace });

  return newSocket;
};

export const invalidateSocket = (socket: Socket) => {
  const found = sockets.find((value) => {
    return value.socket === socket;
  });
  if (found) {
    found.socket.disconnect();
    found.socket.removeAllListeners();
    const index = sockets.indexOf(found);
    sockets.splice(index, 1);
  }
};

export const invalidateSocketByNamespace = (namespace: string) => {
  const found = sockets.find((value) => {
    return value.namespace === namespace;
  });
  if (found) {
    found.socket.disconnect();
    found.socket.removeAllListeners();
    const index = sockets.indexOf(found);
    sockets.splice(index, 1);
  }
};
