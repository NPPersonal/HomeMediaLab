import React, { useContext } from "react";
import { Card, CardFooter } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";
import { Button } from "../../ui/button";
import { SquareX } from "lucide-react";
import TaskCollection from "./collection";
import { CheckpointsContext } from "@/context/checkpoints-context";
import { CheckpointType } from "@/hooks/download-checkpoints";
import TaskCardHeader from "./task-card/task-card-header";
import TaskCardContent from "./task-card/task-card-content";

interface PropType {
  onDelete: (task: CheckpointType) => void;
}
const CopmletedTaskCollection = (props: PropType) => {
  const { onDelete } = props;
  const { checkpoints } = useContext(CheckpointsContext);

  return (
    <TaskCollection
      tasks={checkpoints.completed}
      renderTask={(task) => {
        return (
          <Card>
            <TaskCardHeader taskData={task} />
            <TaskCardContent taskData={task} />
            <CardFooter className="flex space-x-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => onDelete(task)}
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

export default CopmletedTaskCollection;
