"use client";

import { Card } from "@/components/ui/card";
import React from "react";
import { Label } from "@/components/ui/label";
import { CheckpointType } from "@/hooks/download-checkpoints";
import TaskCardHeader from "./task-card/task-card-header";
import TaskCardContent from "./task-card/task-card-content";
interface PropType {
  tasks: Array<CheckpointType>;
  /**
   * Use custom rendering for task item
   *
   * A function take task data and return React node
   * `(task)=>React.ReactNode`
   */
  renderTask?: (task: CheckpointType) => React.ReactNode;
}
const TaskCollection = (props: PropType) => {
  const { tasks, renderTask } = props;

  if (tasks.length === 0) {
    return (
      <div className="flex items-center, justify-center">
        <Label htmlFor="term" className="font-bold">
          Empty
        </Label>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full space-y-2">
      {tasks.map((task) => {
        if (renderTask) return <div key={task.taskId}>{renderTask(task)}</div>;

        return (
          <Card key={task.taskId}>
            <TaskCardHeader taskData={task} />
            <TaskCardContent taskData={task} />
          </Card>
        );
      })}
    </div>
  );
};

export default TaskCollection;
