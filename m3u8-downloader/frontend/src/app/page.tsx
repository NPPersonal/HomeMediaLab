"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useCheckpoints from "@/hooks/download-checkpoints";
import React from "react";
import TaskQueue from "@/components/task-queue/task-queue";

export default function Home() {
  const { checkpoints } = useCheckpoints();

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
          <TaskQueue taskQueued={checkpoints.queued} />
        </TabsContent>
        <TabsContent
          className="flex flex-col items-center min-h-screen"
          value="completed"
        >
          <TaskQueue taskQueued={checkpoints.completed} />
        </TabsContent>
        <TabsContent
          className="flex flex-col items-center min-h-screen"
          value="canceled"
        >
          <TaskQueue taskQueued={checkpoints.canceled} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
