import fs from "fs-extra";
import { Observable } from "object-observer";
import { M3U8DownloadTask } from "./download-task.js";

const DATA_FILE_PATH = "task-data.json";
export default class DownloadManager {
  static #_instance;
  #taskQueue = [];
  #taskCheckpoint = Observable.from({ queued: [], completed: [] });

  get taskCheckpoint() {
    return this.#taskCheckpoint;
  }

  static get manager() {
    if (DownloadManager.#_instance) return DownloadManager.#_instance;
    DownloadManager.#_instance = new DownloadManager().init();
    return DownloadManager.#_instance;
  }

  constructor() {
    if (fs.pathExistsSync(DATA_FILE_PATH)) {
      this.#taskCheckpoint = Observable.from(fs.readJsonSync(DATA_FILE_PATH));
    } else {
      fs.writeJSONSync(DATA_FILE_PATH, this.#taskCheckpoint);
    }
  }

  init() {
    Observable.observe(this.#taskCheckpoint, (changes) => {
      console.log(changes);
    });
    return this;
  }

  /**
   * Find a download task by task's id
   *
   * @param {string} taskId task's id to match
   * @returns a download task otherwise undefined
   */
  findTaskById(taskId) {
    const task = this.#taskQueue.find((task) => {
      return task.taskId === taskId;
    });
    return task;
  }

  /**
   * Add a new task to manager's task queue
   *
   * @param {M3U8DownloadTask} task
   * @returns M3U8DownloadTask or undeinfed
   */
  addTask(task) {
    const foundTask = this.findTaskById(task.taskId);
    if (foundTask) {
      console.error(
        `Unable to add task to queue task id ${task.taskId} already exists`
      );
      return undefined;
    }

    this.registerListenerToTask(task);
    this.#taskQueue.push(task);

    return task;
  }

  /**
   * Remove a task from manager's task queue by task's id
   *
   * @param {string} taskId task's id to match
   */
  removeTaskById(taskId) {
    const foundTask = this.findTaskById(taskId);
    if (foundTask) {
      const taskIndex = this.#taskQueue.indexOf(foundTask);
      if (taskIndex > -1) this.#taskQueue.splice(taskIndex, 1);
      return;
    }
    console.warn(
      `Unable to remove task from queue, task id ${taskId} doesn't exists`
    );
  }

  registerListenerToTask(downloadTask) {
    downloadTask.on(M3U8DownloadTask.EventTypes.Begin, (task) => {
      console.log(`Downloader begin ${task.taskId}`);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Progress, (task, progress) => {
      // console.log(`Download task ${task.taskId} progress`, progress);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Error, (task, error) => {
      console.log(`Download task ${task.taskId} error`, error);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Completed, (task, report) => {
      console.log(`Download task ${task.taskId} completed`);
      this.removeTaskById(task.taskId);
    });
  }
}
