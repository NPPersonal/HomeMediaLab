import express from "express";
const app = express();
const port = 3000;

import {
  createDownloader,
  generateTSMergeList,
  convertTSToMP4,
  removeWorkingDir,
} from "./utils/m3u8-utils.js";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";
import { TEMP_DIR } from "./utils/constant.js";

const tasks = [];
const M3U8_MASTER_TEST_URL =
  "https://vip.lz-cdn6.com/20220817/22481_342a8e06/index.m3u8";
const M3U8_TEST_URL =
  "https://vip.lz-cdn6.com/20220817/22481_342a8e06/1000k/hls/mixed.m3u8";

import { M3U8DownloadTask } from "./download-manager/download-task.js";

app.get("/test", (req, res) => {
  const downloadTask = new M3U8DownloadTask();
  downloadTask.init(M3U8_MASTER_TEST_URL, "output/.out.mp4", TEMP_DIR);
  tasks.push(downloadTask);

  downloadTask.on(M3U8DownloadTask.EventTypes.Begin, (task) => {
    console.log(`Downloader begin ${task.id}`);
  });

  downloadTask.on(M3U8DownloadTask.EventTypes.Progress, (task, progress) => {
    console.log(`Download task ${task.id} progress`, progress);
  });

  downloadTask.on(M3U8DownloadTask.EventTypes.Error, (task, error) => {
    console.log(`Download task ${task.id} error`, error);
  });

  downloadTask.on(M3U8DownloadTask.EventTypes.Completed, (task, report) => {
    console.log(`Download task ${task.id} completed`, report);
  });

  downloadTask.start();
  // const id = uuidv4();
  // const workingPath = path.join(TEMP_DIR, id);
  // const downloader = new M3U8Downloader(
  //   M3U8_MASTER_TEST_URL,
  //   "output/out.mp4",
  //   {
  //     mergeSegments: true,
  //     convert2Mp4: true,
  //     clean: true,
  //     segmentsDir: workingPath, // the directory to store downloaded segments
  //   }
  // );
  // tasks.push(downloader);
  // downloader.on(M3U8Downloader.EventTypes.Progress, (progress) => {
  //   console.log(
  //     `Download progress: ${progress.downloaded}/${progress.total} ${progress.url}`
  //   );
  // });

  // downloader.on(M3U8Downloader.EventTypes.Completed, (report) => {
  //   console.log("Download completed", report);
  // });

  // downloader.on(M3U8Downloader.EventTypes.Error, (error) => {
  //   console.error("Error occurred:", error);
  // });
  // downloader.download();
  res.send("download started");
});

app.get("/download", (req, res) => {
  const id = uuidv4();
  const workingPath = path.join(TEMP_DIR, id);
  const downloader = createDownloader(
    workingPath,
    M3U8_TEST_URL,
    10,
    (data) => {
      console.log(data.path);
    },
    (error) => {
      console.error(error);
    }
  );

  tasks.push(downloader);

  downloader.startDownload().then(async (response) => {
    console.log("download successful", response);
    try {
      const tsFilePath = await generateTSMergeList(workingPath);
      await convertTSToMP4(tsFilePath);
      await removeWorkingDir(workingPath);
    } catch (err) {
      console.error(err);
    }
  });
  res.send(`dwonload m3u8 video from ${req.query.url}`);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
