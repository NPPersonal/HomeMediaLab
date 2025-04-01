import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { getTempDirectory } from "./utils/utils.js";
import { M3U8DownloadTask } from "./download-manager/tasks/m3u8-download-task.js";
import DownloadManager from "./download-manager/download-manager.js";
import { createRoute as createHLSRoute } from "./routes/hls.js";
import { createRoute as createTaskRoute } from "./routes/task.js";
import { getOutputFilePath } from "./utils/utils.js";
import { createRoute as createTestRoute } from "./routes/test.js";

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

/**
 * Middleware that check if download hls route's request contain correct
 * parameters in body
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const checkDownloadHLSRequest = (req, res, next) => {
  const { url, output } = req.body;
  if (!url) {
    res
      .status(400)
      .send(JSON.stringify({ message: "url is missing in request's body" }));
  }
  if (!output) {
    res
      .status(400)
      .send(JSON.stringify({ message: "output is missing in request's body" }));
  }
  next();
};
//#endregion Express middleware

//#region  API routes
// test routes
app.use("/test", createTestRoute(manager));

// hls routes
app.use("/hls", createHLSRoute(manager));

// task routes
app.use("/task", createTaskRoute(manager));
//#endregion API routes

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
