import express from "express";
import { checkDownloadHLSRequest } from "../middlewares/middlewares.js";
import { M3U8DownloadTask } from "../download-manager/tasks/m3u8-download-task.js";
import { getOutputFilePath, getTempDirectory } from "../utils/utils.js";
import DownloadManager from "../download-manager/download-manager.js";
import { scrapeM3U8Urls } from "../utils/scrapper.js";

const router = express.Router();

/**
 * Create an app route of HLS
 * @param {DownloadManager} manager
 * @returns
 */
export function createRoute(manager) {
  router.post("/download", checkDownloadHLSRequest, (req, res) => {
    const { url, output } = req.body;

    const task = manager.addTask(
      new M3U8DownloadTask().init(
        url,
        getOutputFilePath(output),
        getTempDirectory()
      )
    );
    manager.startTaskBy(task.taskId);
    res.status(200).send(JSON.stringify({ taskId: task.taskId }));
  });

  router.get("/scrape", async (req, res) => {
    try {
      const url = req.query.url;
      const m3u8Urls = await scrapeM3U8Urls(url);
      res.status(200).send({ data: m3u8Urls });
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  return router;
}
