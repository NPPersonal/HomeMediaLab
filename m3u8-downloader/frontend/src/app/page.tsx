"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useCheckpoints from "@/hooks/download-checkpoints";
import React from "react";
import TaskCollection from "@/components/task-collection/task-collection";
import DownloadTask from "@/components/task-collection/download-task";
import {
  cancelTask,
  pauseTask,
  removeTaskFromCanceled,
  removeTaskFromCompleted,
  resumeTask,
} from "@/actions/server-actions";
import CopmletedTask from "@/components/task-collection/completed-task";
import CanceledTask from "@/components/task-collection/canceled-task";

export default function Home() {
  const { checkpoints, socketInfo } = useCheckpoints();

  if (!socketInfo.isConnected) {
    return (
      <div className="flex justify-center items-center">
        <p className="font-bold text-lg break-all">Lost connection to server</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Tabs className="min-w-full" defaultValue="download">
        <TabsList className="flex justify-center w-full">
          <TabsTrigger value="download">{`Download(${checkpoints.queued.length})`}</TabsTrigger>
          <TabsTrigger value="completed">{`Completed(${checkpoints.completed.length})`}</TabsTrigger>
          <TabsTrigger value="canceled">{`Canceled(${checkpoints.canceled.length})`}</TabsTrigger>
        </TabsList>
        <TabsContent
          className="flex flex-col items-center min-h-screen"
          value="download"
        >
          <TaskCollection
            tasks={checkpoints.queued}
            renderTask={(task) => {
              return (
                <DownloadTask
                  taskData={task}
                  onPlayClick={(task) => resumeTask(task.taskId)}
                  onPauseClick={(task) => pauseTask(task.taskId)}
                  onCancelClick={(task) => cancelTask(task.taskId)}
                />
              );
            }}
          />
        </TabsContent>
        <TabsContent
          className="flex flex-col items-center min-h-screen"
          value="completed"
        >
          <TaskCollection
            tasks={checkpoints.completed}
            renderTask={(task) => {
              return (
                <CopmletedTask
                  taskData={task}
                  onDeleteClick={(task) => removeTaskFromCompleted(task.taskId)}
                />
              );
            }}
          />
        </TabsContent>
        <TabsContent
          className="flex flex-col items-center min-h-screen"
          value="canceled"
        >
          <TaskCollection
            tasks={checkpoints.canceled}
            renderTask={(task) => {
              return (
                <CanceledTask
                  taskData={task}
                  onDeleteClick={(task) => removeTaskFromCanceled(task.taskId)}
                />
              );
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
