import express from "express";
const app = express();
const port = 3000;

import { TEMP_DIR } from "./utils/constant.js";

const manager = DownloadManager.manager;
manager.init();

const M3U8_MASTER_TEST_URL =
  "https://vip.lz-cdn6.com/20220817/22481_342a8e06/index.m3u8";
const M3U8_TEST_URL =
  "https://vip.lz-cdn6.com/20220817/22481_342a8e06/1000k/hls/mixed.m3u8";

import { M3U8DownloadTask } from "./download-manager/download-task.js";
import DownloadManager from "./download-manager/download-manager.js";

app.get("/test", (req, res) => {
  const task = manager.addTask(
    new M3U8DownloadTask().init(
      M3U8_MASTER_TEST_URL,
      "output/out.mp4",
      TEMP_DIR
    )
  );

  manager.startTaskBy(task.taskId);

  res.send(`download started task id: ${task.taskId}`);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
