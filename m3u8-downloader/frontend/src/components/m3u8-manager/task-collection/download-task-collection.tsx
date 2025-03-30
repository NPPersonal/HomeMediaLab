"use client";

import React, { useContext } from "react";
import { Card, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pause, Play, SquareX } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";
import TaskCollection from "./collection";
import { CheckpointsContext } from "@/context/checkpoints-context";
import { CheckpointType } from "@/hooks/download-checkpoints";
import TaskCardHeader from "./task-card/task-card-header";
import TaskCardContent from "./task-card/task-card-content";

interface PropType {
  onPauseClick: (task: CheckpointType) => void;
  onResumeClick: (task: CheckpointType) => void;
  onCancelClick: (task: CheckpointType) => void;
}
const DownloadTaskCollection = (props: PropType) => {
  const { onPauseClick, onResumeClick, onCancelClick } = props;
  const { checkpoints } = useContext(CheckpointsContext);

  return (
    <TaskCollection
      tasks={checkpoints.queued}
      renderTask={(task) => {
        return (
          <Card>
            <TaskCardHeader taskData={task} />
            <TaskCardContent taskData={task} />
            <CardFooter className="flex space-x-2">
              {!task.isRunning && task.status === "pause" ? (
                <Button size="icon" onClick={() => onResumeClick(task)}>
                  <Play />
                </Button>
              ) : (
                <Button size="icon" onClick={() => onPauseClick(task)}>
                  <Pause />
                </Button>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => onCancelClick(task)}
                    >
                      <SquareX />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancel this download task?</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardFooter>
          </Card>
        );
      }}
    />
  );
};

export default DownloadTaskCollection;
