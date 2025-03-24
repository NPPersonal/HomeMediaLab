import React from "react";
import { Card, CardFooter } from "@/components/ui/card";
import { TaskPropType } from "./types/task";
import TaskCardHeader from "./task-card/task-card-header";
import TaskCardContent from "./task-card/task-card-content";
import { Button } from "@/components/ui/button";
import { Pause, Play, SquareX } from "lucide-react";
import { CheckpointType } from "@/hooks/download-checkpoints";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface PropType extends TaskPropType {
  onPlayClick: (task: CheckpointType) => void;
  onPauseClick: (task: CheckpointType) => void;
  onCancelClick: (task: CheckpointType) => void;
}

const DownloadTask = (props: PropType) => {
  const { taskData, onPlayClick, onPauseClick, onCancelClick } = props;

  return (
    <Card>
      <TaskCardHeader taskData={taskData} />
      <TaskCardContent taskData={taskData} />
      <CardFooter className="flex space-x-2">
        {!taskData.isRunning && taskData.status === "pause" ? (
          <Button
            size="icon"
            onClick={() => {
              onPlayClick(taskData);
            }}
          >
            <Play />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={() => {
              onPauseClick(taskData);
            }}
          >
            <Pause />
          </Button>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => {
                  onCancelClick(taskData);
                }}
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
};

export default DownloadTask;
