import { CardContent } from "@/components/ui/card";
import React from "react";
import { Label } from "@/components/ui/label";
import KVAccordion from "@/components/kv-accordion/kv-accordion";
import { Progress } from "@/components/ui/progress";
import ListAccordion from "../../list-accordion/list-accordion";
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
          "Downloader Status": taskData.downloaderStatu,
          "Source URL": taskData.m3u8Url,
          Output: taskData.output,
          "Working directory": taskData.workingDir,
          "Downloaded files": taskData.downloaded,
          "Download failed": taskData.downloadFailed,
        }}
      />

      {taskData.options && (
        <KVAccordion
          triggerName="Download settings"
          kvObject={taskData.options}
        />
      )}
      {taskData.eventLogs && (
        <ListAccordion triggerName="Event logs" list={taskData.eventLogs} />
      )}
    </CardContent>
  );
};

export default TaskCardContent;
