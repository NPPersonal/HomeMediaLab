import React from "react";
import { Card, CardFooter } from "@/components/ui/card";
import { TaskPropType } from "./types/task";
import TaskCardHeader from "./task-card/task-card-header";
import TaskCardContent from "./task-card/task-card-content";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Button } from "../ui/button";
import { SquareX } from "lucide-react";
import { CheckpointType } from "@/hooks/download-checkpoints";

interface PropType extends TaskPropType {
  onDeleteClick: (task: CheckpointType) => void;
}
const CopmletedTask = (props: PropType) => {
  const { taskData, onDeleteClick } = props;

  return (
    <Card>
      <TaskCardHeader taskData={taskData} />
      <TaskCardContent taskData={taskData} />
      <CardFooter className="flex space-x-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => {
                  onDeleteClick(taskData);
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

export default CopmletedTask;
