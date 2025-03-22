/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createSocket, invalidateSocket } from "@/lib/socket";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

interface CheckpointsType {
  queued: [{ [key: string]: any }] | [];
  completed: [{ [key: string]: any }] | [];
  canceled: [{ [key: string]: any }] | [];
}

interface SocketInfoType {
  isConnected: boolean;
  socket: Socket | undefined;
  transport: string;
}

const useCheckpoints = () => {
  const [checkpoints, setCheckpoints] = useState<CheckpointsType>({
    queued: [],
    completed: [],
    canceled: [],
  });

  const [socketInfo, setSocketInfo] = useState<SocketInfoType>({
    isConnected: false,
    socket: undefined,
    transport: "N/A",
  });

  useEffect(() => {
    console.log("use effect");
    function onConnected() {
      console.log("on socket connected");
      setSocketInfo((value) => ({
        ...value,
        isConnected: true,
        transport: value.socket ? value.socket.io.engine.transport.name : "N/A",
      }));
    }

    function onDisconnected() {
      console.log("on socket disconnect");
      setSocketInfo((value) => ({
        ...value,
        isConnected: false,
        transport: "N/A",
      }));
    }

    setSocketInfo((value) => ({
      ...value,
      socket: createSocket("/checkpoints", onConnected, onDisconnected),
    }));

    return () => {
      if (socketInfo.socket) invalidateSocket(socketInfo.socket);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function transportUpdated(transport: any) {
      setSocketInfo((value) => ({ ...value, transport: transport.name }));
    }

    function onCheckpoints(checkpoints: any) {
      console.log("on checkpoints");
      setCheckpoints(checkpoints);
    }

    function onInsert(data: any) {
      const queueName: string = data.in;
      const index: number = data.at;

      setCheckpoints((value) => {
        const found = value[queueName as keyof typeof checkpoints].find(
          (value) => {
            return value.taskId === data.value.taskId;
          }
        );

        if (found) return value;

        console.log("insert");
        const newValue = { ...value };
        newValue[queueName as keyof typeof checkpoints].splice(
          index,
          0,
          data.value
        );
        return newValue;
      });
    }

    function onDelete(data: any) {
      const queueName: string = data.in;
      const index: number = data.at;

      setCheckpoints((value) => {
        const found = value[queueName as keyof typeof checkpoints].find(
          (value) => {
            return value.taskId === data.value.taskId;
          }
        );

        if (!found) return value;

        console.log("delete");
        const newValue = { ...value };
        newValue[queueName as keyof typeof checkpoints].splice(index, 1);
        return newValue;
      });
    }

    function onUpdate(data: any) {
      const queueName: string = data.in;
      const index: number = data.at;

      setCheckpoints((value) => {
        const found = value[queueName as keyof typeof checkpoints].find(
          (value) => {
            return value.taskId === data.value.taskId;
          }
        );

        if (!found) return value;

        console.log("update");
        const newValue = { ...value };
        newValue[queueName as keyof typeof checkpoints][index] = data.value;
        return newValue;
      });
    }

    function removeListeners() {
      socketInfo.socket?.io.engine.removeListener("upgrade", transportUpdated);
      socketInfo.socket?.removeListener("checkpoints", onCheckpoints);
      socketInfo.socket?.removeListener("insert", onInsert);
      socketInfo.socket?.removeListener("delete", onDelete);
      socketInfo.socket?.removeListener("update", onUpdate);
    }

    function addListeners() {
      socketInfo.socket?.io.engine.on("upgrade", transportUpdated);
      socketInfo.socket?.on("checkpoints", onCheckpoints);
      socketInfo.socket?.on("insert", onInsert);
      socketInfo.socket?.on("delete", onDelete);
      socketInfo.socket?.on("update", onUpdate);
    }

    if (!socketInfo.socket) {
      console.warn("Socket was not created");
      return;
    }

    removeListeners();
    addListeners();

    return removeListeners;
  }, [socketInfo]);

  return {
    checkpoints,
    socketInfo,
  };
};

export default useCheckpoints;
