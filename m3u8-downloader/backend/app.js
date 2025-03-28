import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { TEMP_DIR } from "./utils/constant.js";
import { M3U8DownloadTask } from "./download-manager/tasks/m3u8-download-task.js";
import DownloadManager from "./download-manager/download-manager.js";
import { scrapeM3U8Urls } from "./utils/scrapper.js";

const M3U8_MASTER_TEST_URL =
  "https://vip.lz-cdn6.com/20220817/22481_342a8e06/index.m3u8";
const M3U8_TEST_URL =
  "https://vip.lz-cdn6.com/20220817/22481_342a8e06/1000k/hls/mixed.m3u8";

//#region Server app setup
const app = express();
app.use(bodyParser.json());
app.use(cors());
const server = createServer(app);
const io = new Server(server);
const port = 3001;
//#endregion Server app setup

//#region SocketIO
// setup socket
const checkpointSocket = io.of("/checkpoints");
checkpointSocket.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", (reason) => {
    console.log(`a user disconnected`, reason);
  });
  // emit checkpoints data when the socket connected
  // console.log(manager.transformedCheckpoints);
  socket.emit("checkpoints", manager.transformedCheckpoints);
});
//#endregion OScketIO

//#region Setup download manager
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
//#endregion Setup download manager

//#region Express middleware
/**
 * Middleware that check if request's body contain task id or not
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @returns
 */
const checkTaskId = (req, res, next) => {
  const { taskId } = req.body;
  if (!taskId) {
    res
      .status(400)
      .send(JSON.stringify({ message: "taskId is missing in request's body" }));
    return;
  }
  // console.log("middleware");
  next();
};
//#endregion Express middleware

//#region  API routes
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

app.get("/download/hls", (req, res) => {
  const url = req.query.url;

  const task = manager.addTask(
    new M3U8DownloadTask().init(url, "output/out.mp4", TEMP_DIR)
  );
  manager.startTaskBy(task.taskId);
  res.status(200).send(JSON.stringify({ taskId: task.taskId }));
});

app.post("/delete/from/completed", checkTaskId, (req, res) => {
  const { taskId } = req.body;

  manager.removeTaskFromCompleted(taskId);
  res.status(200).send(
    JSON.stringify({
      message: `remove task from completed with id: ${taskId}`,
    })
  );
});

app.post("/delete/from/canceled", checkTaskId, (req, res) => {
  const { taskId } = req.body;

  manager.removeTaskFromCanceled(taskId);
  res.status(200).send(
    JSON.stringify({
      message: `remove task from canceled with id: ${taskId}`,
    })
  );
});

app.post("/pause", checkTaskId, (req, res) => {
  const { taskId } = req.body;

  manager.pauseTaskBy(taskId);
  res.status(200).send(JSON.stringify({ message: `pause task id: ${taskId}` }));
});

app.post("/resume", checkTaskId, (req, res) => {
  const { taskId } = req.body;

  manager.resumeTaskBy(taskId);
  res
    .status(200)
    .send(JSON.stringify({ message: `resume task id: ${taskId}` }));
});

app.post("/cancel", checkTaskId, (req, res) => {
  const { taskId } = req.body;

  manager.cancelTaskBy(taskId);
  res
    .status(200)
    .send(JSON.stringify({ message: `cancel task id: ${taskId}` }));
});

app.get("/scrape/hls/from", async (req, res) => {
  try {
    const url = req.query.url;
    const m3u8Urls = await scrapeM3U8Urls(url);
    res.status(200).send({ data: m3u8Urls });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});
//#endregion API routes

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
