"use client";

import useCheckpoints, {
  CheckpointQueuedType,
} from "@/hooks/download-checkpoints";
import { createContext } from "react";

export const CheckpointsContext = createContext<{
  checkpoints: CheckpointQueuedType;
  isConnected: boolean;
}>({
  checkpoints: { queued: [], completed: [], canceled: [] },
  isConnected: false,
});

const CheckpointsProvider = (props: { children: React.ReactNode }) => {
  const { children } = props;
  const { checkpoints, socketInfo } = useCheckpoints();
  return (
    <CheckpointsContext.Provider
      value={{ checkpoints, isConnected: socketInfo.isConnected }}
    >
      {children}
    </CheckpointsContext.Provider>
  );
};

export default CheckpointsProvider;
