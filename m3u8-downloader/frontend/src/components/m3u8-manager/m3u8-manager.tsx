"use client";

import React, { useContext } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowBigDownDash, ListChecks, SquareX } from "lucide-react";
import HLSDownloader from "@/components/hls-downloader/hls-downloader";
import DownloadTaskCollection from "@/components/m3u8-manager/task-collection/download-task-collection";
import { CheckpointsContext } from "@/context/checkpoints-context";
import CopmletedTaskCollection from "./task-collection/completed-task-collection";
import CanceledTaskCollection from "./task-collection/canceled-task-collection";
import {
  cancelTask,
  pauseTask,
  removeTaskFromCanceled,
  removeTaskFromCompleted,
  resumeTask,
} from "@/actions/server-actions";

const M3U8Manager = () => {
  const { checkpoints, isConnected } = useContext(CheckpointsContext);

  if (!isConnected) {
    return (
      <div className="min-w-full text-center">{`Lost connection to server`}</div>
    );
  }
  return (
    <Tabs className="min-w-full" defaultValue="download">
      <TabsList className="flex justify-center w-full">
        <TabsTrigger value="hls-downloader">HLS Downloader</TabsTrigger>
        <TabsTrigger value="download">
          <div className="flex justify-center items-center space-x-2">
            <ArrowBigDownDash />
            {checkpoints.queued.length > 0
              ? `(${checkpoints.queued.length})`
              : null}
          </div>
        </TabsTrigger>
        <TabsTrigger value="completed">
          <div className="flex justify-center items-center space-x-2">
            <ListChecks />
            {checkpoints.completed.length > 0
              ? `(${checkpoints.completed.length})`
              : null}
          </div>
        </TabsTrigger>
        <TabsTrigger value="canceled">
          <div className="flex justify-center items-center space-x-2">
            <SquareX />
            {checkpoints.canceled.length > 0
              ? `(${checkpoints.canceled.length})`
              : null}
          </div>
        </TabsTrigger>
      </TabsList>
      <TabsContent
        className="flex flex-col items-center min-h-screen"
        value="hls-downloader"
      >
        <div className="mt-2">
          <HLSDownloader />
        </div>
      </TabsContent>
      <TabsContent
        className="flex flex-col items-center min-h-screen"
        value="download"
      >
        <DownloadTaskCollection
          onPauseClick={(task) => pauseTask(task.taskId)}
          onResumeClick={(task) => resumeTask(task.taskId)}
          onCancelClick={(task) => cancelTask(task.taskId)}
        />
      </TabsContent>
      <TabsContent
        className="flex flex-col items-center min-h-screen"
        value="completed"
      >
        <CopmletedTaskCollection
          onDelete={(task) => removeTaskFromCompleted(task.taskId)}
        />
      </TabsContent>
      <TabsContent
        className="flex flex-col items-center min-h-screen"
        value="canceled"
      >
        <CanceledTaskCollection
          onDelete={(task) => removeTaskFromCanceled(task.taskId)}
        />
      </TabsContent>
    </Tabs>
  );
};

export default M3U8Manager;
