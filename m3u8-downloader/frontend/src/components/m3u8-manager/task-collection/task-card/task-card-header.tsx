import React from "react";
import { CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TaskPropType } from "../types/task";

const TaskCardHeader = (props: TaskPropType) => {
  const { taskData } = props;

  return (
    <CardHeader>
      <CardDescription>
        <span className="flex space-x-1">
          <Label htmlFor="term">Task ID:</Label>
          <span>{taskData.taskId}</span>
        </span>
        <span className="flex space-x-1">
          <Label htmlFor="term">Status:</Label>
          <span>{`${taskData.status}`}</span>
        </span>
        {taskData.createdAt && (
          <span className="flex space-x-1">
            <Label htmlFor="term">Created at:</Label>
            <span>{`${new Date(taskData.createdAt).toLocaleString()}`}</span>
          </span>
        )}
      </CardDescription>
    </CardHeader>
  );
};

export default TaskCardHeader;
