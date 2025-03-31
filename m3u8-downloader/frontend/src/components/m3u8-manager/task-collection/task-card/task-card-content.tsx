import { CardContent } from "@/components/ui/card";
import React from "react";
import { Label } from "@/components/ui/label";
import KVAccordion from "@/components/kv-accordion/kv-accordion";
import { Progress } from "@/components/ui/progress";
import ListAccordion from "@/components/list-accordion/list-accordion";
import { TaskPropType } from "../types/task";

const TaskCardContent = (props: TaskPropType) => {
  const { taskData } = props;
  const percent = Math.floor(taskData.progress * 100.0);
  return (
    <CardContent>
      {taskData.isRunning && (
        <div className="flex items-center mb-4 space-x-1">
          <Label>{`${percent}%`}</Label>
          <Progress value={percent} />
        </div>
      )}

      <KVAccordion
        triggerName="Information"
        kvObject={{
          Status: taskData.status,
          "Created at": taskData.createdAt
            ? new Date(taskData.createdAt).toLocaleString()
            : "",
          "Source URL": taskData.m3u8Url,
          Output: taskData.output,
          "Working directory": taskData.workingDir,
          "Downloaded files": taskData.downloadedSegments,
          "Download failed": taskData.downloadFailedSegments,
          "Total files": taskData.totalSegments,
        }}
      />

      {taskData.options && (
        <KVAccordion
          triggerName="Download settings"
          kvObject={taskData.options}
        />
      )}
      {taskData.eventLogs && (
        <ListAccordion
          triggerName={`Event logs${
            taskData.eventLogs.length > 0
              ? `(${taskData.eventLogs.length})`
              : ""
          }`}
          list={taskData.eventLogs}
        />
      )}
      {taskData.errorLogs && (
        <ListAccordion
          triggerName={`Error logs${
            taskData.errorLogs.length > 0
              ? `(${taskData.errorLogs.length})`
              : ""
          }`}
          list={taskData.errorLogs}
        />
      )}
    </CardContent>
  );
};

export default TaskCardContent;
