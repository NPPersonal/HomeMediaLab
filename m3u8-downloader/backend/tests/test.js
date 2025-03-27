import { M3U8DownloadTask } from "../download-manager/tasks/m3u8-download-task.js";

const M3U8_MASTER_TEST_URL =
  "https://vip.lz-cdn6.com/20220817/22481_342a8e06/index.m3u8";

const task = new M3U8DownloadTask().init(
  M3U8_MASTER_TEST_URL,
  "output/out.mp4",
  "./tmp"
);

task.on(M3U8DownloadTask.EventTypes.Error, (task, error) => {
  console.log(`error: ${error}`);
});

task.on(M3U8DownloadTask.EventTypes.Pause, (task) => {
  console.log(`task paused ${task.taskId}`);
});

task.on(M3U8DownloadTask.EventTypes.Resume, (task) => {
  console.log(`task resumed ${task.taskId}`);
});

task.on(M3U8DownloadTask.EventTypes.Progress, (task, progress) => {
  console.log(`\rprogress: ${progress.downloaded / progress.total}`);
});

task.on(M3U8DownloadTask.EventTypes.Merging, (task) => {
  console.log(`merging video segments`);
});

task.on(M3U8DownloadTask.EventTypes.Converting, (task) => {
  console.log(`converting video`);
});

task.on(M3U8DownloadTask.EventTypes.Start, (task) => {
  console.log(`task start ${task.taskId}`);
});

task.on(M3U8DownloadTask.EventTypes.Canceled, (task) => {
  console.log(`task canceled ${task.taskId}`);
});

task.on(M3U8DownloadTask.EventTypes.Completed, (task) => {
  console.log(`task completed ${task.taskId}`, task.serializeToJSON());
});

task.on(M3U8DownloadTask.EventTypes.StatusChanged, (oldState, newState) => {
  console.log(`${oldState} -> ${newState}`);
});

task.start();

const t = setTimeout(() => {
  task.pause();
  console.log(task.serializeToJSON());
  setTimeout(async () => {
    await task.resume();
  }, 5000);
}, 8000);

// const jsonData = task.serializeToJSON();
// console.log(jsonData);
// const recoveredTask = M3U8DownloadTask.deserializeFromJSON(jsonData);
// console.log(recoveredTask.constructor.name);
// console.log(recoveredTask.queue);
