"use client";

import { CheckpointType } from "@/hooks/download-checkpoints";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import React from "react";
import { Label } from "@/components/ui/label";
import KVAccordion from "@/components/kv-accordion/kv-accordion";
import { Progress } from "@/components/ui/progress";
import ListAccordion from "../list-accordion/list-accordion";
interface PropType {
  taskQueued: Array<CheckpointType>;
}
const TaskQueue = (props: PropType) => {
  const { taskQueued } = props;

  if (taskQueued.length === 0) {
    return (
      <div className="flex items-center, justify-center">
        <Label htmlFor="term" className="font-bold">
          Empty
        </Label>
      </div>
    );
  }

  return (
    <React.Fragment>
      {taskQueued.map((task) => {
        const percent = Math.floor(task.progress * 100.0);

        return (
          <Card key={task.taskId} className="min-w-full m-2">
            <CardHeader>
              <CardDescription>
                <span className="flex space-x-1">
                  <Label htmlFor="term">Task ID:</Label>
                  <span>{task.taskId}</span>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {task.isRunning && (
                <div className="flex items-center mb-4 space-x-1">
                  <Label>{`${percent}%`}</Label>
                  <Progress value={percent} />
                </div>
              )}
              <p className="flex space-x-1">
                <Label htmlFor="term">Status:</Label>
                <span>{task.status}</span>
              </p>
              <p className="flex space-x-1">
                <Label htmlFor="term">Working directory:</Label>
                <span>{task.workingDir}</span>
              </p>
              <p className="flex space-x-1">
                <Label htmlFor="term">Downloaded files:</Label>
                <span>{task.downloaded}</span>
              </p>
              <p className="flex space-x-1">
                <Label htmlFor="term">Download failed:</Label>
                <span>{task.downloadFailed}</span>
              </p>
              {task.options && (
                <KVAccordion
                  triggerName="Download settings"
                  kvObject={task.options}
                />
              )}
              {task.eventLogs && (
                <ListAccordion triggerName="Event logs" list={task.eventLogs} />
              )}
            </CardContent>
            <CardFooter>
              <p>Card Footer</p>
            </CardFooter>
          </Card>
        );
      })}
    </React.Fragment>
  );
};

export default TaskQueue;
