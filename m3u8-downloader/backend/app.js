import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { TEMP_DIR } from "./utils/constant.js";

const app = express();
const server = createServer(app);
const io = new Server(server);
const port = 3001;

// setup socket
const checkpointSocket = io.of("/checkpoints");
checkpointSocket.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", (reason) => {
    console.log(`a user disconnected`, reason);
  });
  // emit checkpoints data when the socket connected
  socket.emit("checkpoints", manager.checkpoints);
});

const manager = DownloadManager.manager;
manager.on(DownloadManager.CheckpointEventTypes.Update, (data) => {
  // console.log("manager update", JSON.stringify(data), "\n");
  checkpointSocket.emit("update", data);
});
manager.on(DownloadManager.CheckpointEventTypes.Insert, (data) => {
  // console.log("manager insert", JSON.stringify(data), "\n");
  checkpointSocket.emit("insert", data);
});
manager.on(DownloadManager.CheckpointEventTypes.Delete, (data) => {
  // console.log("manager delete", JSON.stringify(data), "\n");
  checkpointSocket.emit("delete", data);
});
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

app.get("/deleteFromCompleted", (req, res) => {
  const taskId = req.query.taskId;
  manager.removeTaskFromCompleted(taskId);
  res.send(`Removed task from completed queue task id: ${taskId}`);
});

app.get("/deleteFromCanceled", (req, res) => {
  const taskId = req.query.taskId;
  manager.removeTaskFromCanceled(taskId);
  res.send(`Removed task from canceled queue task id: ${taskId}`);
});

app.get("/pause", (req, res) => {
  const taskId = req.query.taskId;
  manager.pauseTaskBy(taskId);
  res.send(`Pause task id: ${taskId}`);
});

app.get("/resume", (req, res) => {
  const taskId = req.query.taskId;
  manager.resumeTaskBy(taskId);
  res.send(`Resume task id: ${taskId}`);
});

app.get("/cancel", (req, res) => {
  const taskId = req.query.taskId;
  manager.cancelTaskBy(taskId);
  res.send(`Cancel task id: ${taskId}`);
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
