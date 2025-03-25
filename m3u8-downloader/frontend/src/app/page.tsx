"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useCheckpoints from "@/hooks/download-checkpoints";
import React, { useEffect, useState } from "react";
import TaskCollection from "@/components/task-collection/task-collection";
import DownloadTask from "@/components/task-collection/download-task";
import {
  cancelTask,
  downloadHLS,
  pauseTask,
  removeTaskFromCanceled,
  removeTaskFromCompleted,
  resumeTask,
  scrapeHLSFromWeb,
} from "@/actions/server-actions";
import CopmletedTask from "@/components/task-collection/completed-task";
import CanceledTask from "@/components/task-collection/canceled-task";
import { Input } from "@/components/ui/input";
import { isM3U8Url, isUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import HLSDownloader from "@/components/hls-downloader/hls-downloader";
import { ArrowBigDownDash, CircleX, ListChecks, SquareX } from "lucide-react";

export default function Home() {
  const { checkpoints } = useCheckpoints();
  const [webUrl, setWebUrl] = useState("");
  const [scrappingUrl, setScrappingUrl] = useState("");
  const [foundHLSUrls, setFoundHLSUrls] = useState<string[] | undefined>(
    undefined
  );
  const [isScrapping, setIsScrapping] = useState(false);
  const [scrappingError, setScrappingError] = useState<Error | undefined>(
    undefined
  );

  const onHLSDownload = async (url: string) => {
    downloadHLS(url);
  };

  useEffect(() => {
    async function scrapeHLS(url: string) {
      try {
        setIsScrapping(true);
        let data = undefined;
        if (isM3U8Url(url)) {
          data = [url];
        } else {
          const jsonData = await scrapeHLSFromWeb(url);
          data = jsonData.data;
        }
        // console.log(data);
        setIsScrapping(false);
        setScrappingError(undefined);
        setFoundHLSUrls(data);
      } catch (error) {
        setFoundHLSUrls(undefined);
        if (error instanceof Error) {
          setScrappingError(error);
        } else {
          setScrappingError(new Error(`Scrapping HLS fail ${url}`));
        }
      }
    }

    if (scrappingUrl !== "") {
      if (isUrl(scrappingUrl)) {
        scrapeHLS(scrappingUrl);
      } else {
        setScrappingError(new Error(`HLS url not valid ${scrappingUrl}`));
      }
    }
  }, [scrappingUrl]);

  // if (!socketInfo.isConnected) {
  //   return (
  //     <div className="flex justify-center items-center">
  //       <p className="font-bold text-lg break-all">Lost connection to server</p>
  //     </div>
  //   );
  // }

  return (
    <div className="flex justify-center">
      <Tabs className="min-w-full" defaultValue="download">
        <TabsList className="flex justify-center w-full">
          <TabsTrigger value="hls-downloader">HLS Downloader</TabsTrigger>
          <TabsTrigger value="download">
            <div className="flex justify-center items-center space-x-2">
              <ArrowBigDownDash />
              {checkpoints.queued.length > 0
                ? `(${checkpoints.queued.length})`
                : null}
            </div>
          </TabsTrigger>
          <TabsTrigger value="completed">
            <div className="flex justify-center items-center space-x-2">
              <ListChecks />
              {checkpoints.completed.length > 0
                ? `(${checkpoints.completed.length})`
                : null}
            </div>
          </TabsTrigger>
          <TabsTrigger value="canceled">
            <div className="flex justify-center items-center space-x-2">
              <SquareX />
              {checkpoints.canceled.length > 0
                ? `(${checkpoints.canceled.length})`
                : null}
            </div>
          </TabsTrigger>
        </TabsList>
        <TabsContent
          className="flex flex-col items-center min-h-screen"
          value="hls-downloader"
        >
          <div className="flex flex-col items-center space-y-2">
            <p>Scrape HLS URL from website or direct HLS URL</p>
            <div className="flex justify-center space-x-2">
              <Input
                value={webUrl}
                placeholder="Enter website url or HLS url"
                onChange={(value) => setWebUrl(value.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWebUrl("")}
              >
                <CircleX />
              </Button>
            </div>
            {scrappingError && (
              <p className="text-red-500 break-all">{scrappingError.message}</p>
            )}
            <Button
              variant="outline"
              disabled={isScrapping}
              onClick={() => setScrappingUrl(webUrl)}
            >
              {isScrapping ? "Scrapping ..." : "Scrape HLS"}
            </Button>
          </div>
          <div className="mt-2">
            <HLSDownloader
              hlsUrls={foundHLSUrls}
              onDownloadClick={onHLSDownload}
            />
          </div>
        </TabsContent>
        <TabsContent
          className="flex flex-col items-center min-h-screen"
          value="download"
        >
          <TaskCollection
            tasks={checkpoints.queued}
            renderTask={(task) => {
              return (
                <DownloadTask
                  taskData={task}
                  onPlayClick={(task) => resumeTask(task.taskId)}
                  onPauseClick={(task) => pauseTask(task.taskId)}
                  onCancelClick={(task) => cancelTask(task.taskId)}
                />
              );
            }}
          />
        </TabsContent>
        <TabsContent
          className="flex flex-col items-center min-h-screen"
          value="completed"
        >
          <TaskCollection
            tasks={checkpoints.completed}
            renderTask={(task) => {
              return (
                <CopmletedTask
                  taskData={task}
                  onDeleteClick={(task) => removeTaskFromCompleted(task.taskId)}
                />
              );
            }}
          />
        </TabsContent>
        <TabsContent
          className="flex flex-col items-center min-h-screen"
          value="canceled"
        >
          <TaskCollection
            tasks={checkpoints.canceled}
            renderTask={(task) => {
              return (
                <CanceledTask
                  taskData={task}
                  onDeleteClick={(task) => removeTaskFromCanceled(task.taskId)}
                />
              );
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
