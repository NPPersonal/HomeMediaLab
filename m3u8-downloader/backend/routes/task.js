import express from "express";
import { checkTaskId } from "../middlewares/middlewares.js";
import DownloadManager from "../download-manager/download-manager.js";

const router = express.Router();

/**
 * Create an app route of task
 *
 * @param {DownloadManager} manager
 * @returns
 */
export function createRoute(manager) {
  router.post("/delete/from/completed", checkTaskId, (req, res) => {
    const { taskId } = req.body;

    manager.removeTaskFromCompleted(taskId);
    res.status(200).send(
      JSON.stringify({
        message: `remove task from completed with id: ${taskId}`,
      })
    );
  });

  router.post("/delete/from/canceled", checkTaskId, (req, res) => {
    const { taskId } = req.body;

    manager.removeTaskFromCanceled(taskId);
    res.status(200).send(
      JSON.stringify({
        message: `remove task from canceled with id: ${taskId}`,
      })
    );
  });

  router.post("/pause", checkTaskId, (req, res) => {
    const { taskId } = req.body;

    manager.pauseTaskBy(taskId);
    res
      .status(200)
      .send(JSON.stringify({ message: `pause task id: ${taskId}` }));
  });

  router.post("/resume", checkTaskId, (req, res) => {
    const { taskId } = req.body;

    manager.resumeTaskBy(taskId);
    res
      .status(200)
      .send(JSON.stringify({ message: `resume task id: ${taskId}` }));
  });

  router.post("/cancel", checkTaskId, (req, res) => {
    const { taskId } = req.body;

    manager.cancelTaskBy(taskId);
    res
      .status(200)
      .send(JSON.stringify({ message: `cancel task id: ${taskId}` }));
  });
  return router;
}
