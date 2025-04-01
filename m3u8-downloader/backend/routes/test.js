import express from "express";
import { M3U8DownloadTask } from "../download-manager/tasks/m3u8-download-task.js";
import { getOutputFilePath, getTempDirectory } from "../utils/utils.js";
import DownloadManager from "../download-manager/download-manager.js";

const router = express.Router();

/**
 * Create an app route of test
 *
 * @param {DownloadManager} manager
 * @returns
 */
export function createRoute(manager) {
  const M3U8_MASTER_TEST_URL =
    "https://vip.lz-cdn6.com/20220817/22481_342a8e06/index.m3u8";
  const M3U8_TEST_URL =
    "https://vip.lz-cdn6.com/20220817/22481_342a8e06/1000k/hls/mixed.m3u8";

  router.get("/make/download", (req, res) => {
    const task = manager.addTask(
      new M3U8DownloadTask().init(
        M3U8_MASTER_TEST_URL,
        getOutputFilePath("output/out.mp4"),
        getTempDirectory()
      )
    );
    manager.startTaskBy(task.taskId);
    res.send(`download started task id: ${task.taskId}`);
  });
  return router;
}
