import React from "react";
import { Card, CardFooter } from "@/components/ui/card";
import { TaskPropType } from "./types/task";
import TaskCardHeader from "./task-card/task-card-header";
import TaskCardContent from "./task-card/task-card-content";
import { CheckpointType } from "@/hooks/download-checkpoints";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { SquareX } from "lucide-react";
import { Button } from "../ui/button";

interface PropType extends TaskPropType {
  onDeleteClick: (task: CheckpointType) => void;
}
const CanceledTask = (props: PropType) => {
  const { taskData, onDeleteClick } = props;

  return (
    <Card>
      <TaskCardHeader taskData={taskData} />
      <TaskCardContent taskData={taskData} />
      <CardFooter>
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

export default CanceledTask;
