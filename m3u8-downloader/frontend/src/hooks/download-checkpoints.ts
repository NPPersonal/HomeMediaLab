/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createSocket, invalidateSocket } from "@/lib/socket";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

export interface CheckpointType {
  taskId: string;
  isRunning: boolean;
  status: string;
  createdAt: number;
  m3u8Url: string;
  output: string;
  workingDir: string;
  downloadedSegments: number;
  downloadFailedSegments: number;
  totalSegments: number;
  progress: number;
  options: { [key: string]: any };
  [key: string]: any;
  eventLogs: Array<string>;
  errorLogs: Array<string>;
}
export interface CheckpointQueuedType {
  queued: Array<CheckpointType>;
  completed: Array<CheckpointType>;
  canceled: Array<CheckpointType>;
}

export interface SocketInfoType {
  isConnected: boolean;
  socket: Socket | undefined;
  transport: string;
}

const useCheckpoints = () => {
  const [checkpoints, setCheckpoints] = useState<CheckpointQueuedType>({
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
      console.log("useeffect destroy");
      if (socketInfo.socket) invalidateSocket(socketInfo.socket);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function transportUpdated(transport: any) {
      setSocketInfo((value) => ({ ...value, transport: transport.name }));
    }

    function onCheckpoints(checkpoints: any) {
      // console.log("on checkpoints");
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

        // make a copy of checkpoint from old checkpoint state
        const newValue = { ...value };
        /**
         * ! important if you don't do the following
         * react would not rerender view when state changed
         */
        // create a new array from the queue
        const newQueue = Array.from(
          newValue[queueName as keyof typeof checkpoints]
        );
        // manipulate the new array which is insert a value
        newQueue.splice(index, 0, data.value);
        // re-assign the new array back to new checkpoint's queue
        newValue[queueName as keyof typeof checkpoints] = newQueue;
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

        // console.log("delete", queueName, index);

        // make a copy of checkpoint from old checkpoint state
        const newValue = { ...value };

        /**
         * ! important if you don't do the following
         * react would not rerender view when state changed
         */
        // create a new array from the queue
        const newQueue = Array.from(
          newValue[queueName as keyof typeof checkpoints]
        );

        // manipulate the new array which is delete a value from new array
        newQueue.splice(index, 1);

        // re-assign the new array back to new checkpoint's queue
        newValue[queueName as keyof typeof checkpoints] = newQueue;
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

        // console.log("update", queueName, index);
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
