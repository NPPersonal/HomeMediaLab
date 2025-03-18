import fs from "fs-extra";
import { Observable } from "object-observer";
import { M3U8DownloadTask } from "./download-task.js";

const DATA_FILE_PATH = "task-checkpoints.json";
export default class DownloadManager {
  static #_instance;
  #taskQueue = [];
  #taskCheckpoint = Observable.from({
    queued: [],
    completed: [],
    canceled: [],
  });

  /**
   * Return the single instance of manager
   */
  static get manager() {
    if (DownloadManager.#_instance) return DownloadManager.#_instance;
    DownloadManager.#_instance = new DownloadManager().init();
    return DownloadManager.#_instance;
  }

  /**
   * Create an instance of manager
   *
   */
  constructor() {
    // load checkpoint json file
    if (fs.pathExistsSync(DATA_FILE_PATH)) {
      this.#taskCheckpoint = Observable.from(fs.readJsonSync(DATA_FILE_PATH));
    } else {
      fs.writeJSONSync(DATA_FILE_PATH, this.#taskCheckpoint);
    }
  }

  /**
   * Initialize the manager
   *
   * @returns manager instance
   */
  init() {
    // observe task checkpoint data change and write
    // data to json file
    Observable.observe(this.#taskCheckpoint, (changes) => {
      try {
        fs.writeJsonSync(DATA_FILE_PATH, this.#taskCheckpoint);

        changes.forEach((change) => {
          console.log(
            `write to json file ${change.type}`,
            change.type === "insert" || change.type === "update"
              ? change.value.progress
              : 0
          );
        });
      } catch (error) {
        console.error(`Fail to write to json file ${error}`);
      }
    });
    return this;
  }

  /**
   * Start a specific task
   *
   * @param {string} taskId
   */
  startTaskBy(taskId) {
    const foundTask = this.findTaskBy(taskId);
    if (foundTask) {
      foundTask.start();
    }
  }

  /**
   * Pause a specific task
   *
   * @param {string} taskId
   */
  pauseTaskBy(taskId) {
    const foundTask = this.findTaskBy(taskId);
    if (foundTask) {
      foundTask.pause();
    }
  }

  /**
   * Resume a specific task
   *
   * @param {string} taskId
   */
  resumeTaskBy(taskId) {
    const foundTask = this.findTaskBy(taskId);
    if (foundTask) {
      foundTask.resume();
    }
  }

  /**
   * Cancel a specific task
   *
   * @param {string} taskId
   */
  cancelTaskBy(taskId) {
    const foundTask = this.findTaskBy(taskId);
    if (foundTask) {
      foundTask.cancel();
    }
  }

  /**
   * Find a download task by task's id
   *
   * @param {string} taskId task's id to match
   * @returns a download task otherwise undefined
   */
  findTaskBy(taskId) {
    const task = this.#taskQueue.find((task) => {
      return task.taskId === taskId;
    });
    return task;
  }

  /**
   * Find a checkpoint
   *
   * @param {string} taskId
   * @param {string} inProp queued, completed, canceled
   * @returns checkpoint as an Object
   */
  findTaskCheckpointBy(taskId, inProp) {
    const foundCheckpoint = this.#taskCheckpoint[inProp].find((checkpoint) => {
      return checkpoint.taskId === taskId;
    });
    return foundCheckpoint;
  }

  /**
   * Add a task to manager's queue
   *
   * **Make sure the task is initialized
   * before add it to the manager**
   *
   * @param {M3U8DownloadTask} task
   * @returns M3U8DownloadTask or undefined
   */
  queueAddTask(task) {
    // add task to task queue
    const foundTask = this.findTaskBy(task.taskId);
    if (foundTask) {
      console.error(
        `Unable to add task to queue task id ${task.taskId} already exists`
      );
      return undefined;
    }
    this.#taskQueue.unshift(task);

    // listening to events from task
    this.registerListenerToTask(task);

    // don't add check point if it is exists
    const foundCheckpoint = this.findTaskCheckpointBy(task.taskId, "queued");
    if (foundCheckpoint) return;

    // add task's checkpoint ot checkpoint queued
    const taskCheckpoint = task.toJson();
    this.#taskCheckpoint.queued.unshift(taskCheckpoint);

    return task;
  }

  /**
   * Move a task to completed queue
   *
   * @param {M3U8DownloadTask} task
   * @returns
   */
  queueMoveTaskToCompleted(task) {
    // remove from task queue
    const taskIndex = this.#taskQueue.indexOf(task);
    if (taskIndex > -1) {
      this.#taskQueue.splice(taskIndex, 1);
    } else {
      {
        console.error(`task ${task.taskId} doesn't exists in queue`);
        return;
      }
    }

    // remove task checkpoint from checkpoint queued if it is exists
    const foundCheckpoint = this.findTaskCheckpointBy(task.taskId, "queued");
    if (foundCheckpoint) {
      const checkpointIndex =
        this.#taskCheckpoint.queued.indexOf(foundCheckpoint);
      this.#taskCheckpoint.queued.splice(checkpointIndex, 1);
    } else {
      console.warn(
        `Unable to remove task ${task.taskId} from checkpoint queued`
      );
    }

    // add task checkpoint to checkpoint completed
    const taskCheckpoint = task.toJson();
    this.#taskCheckpoint.completed.unshift(taskCheckpoint);
  }

  /**
   * Move task to canceld queue
   *
   * @param {M3U8DownloadTask} task
   * @returns
   */
  queueMoveTaskToCanceled(task) {
    // remove from task queue
    const taskIndex = this.#taskQueue.indexOf(task);
    if (taskIndex > -1) {
      this.#taskQueue.splice(taskIndex, 1);
    } else {
      console.error(`task ${task.taskId} doesn't exists in queue`);
      return;
    }

    // remove task checkpoint from checkpoint queued if it is exists
    const foundCheckpoint = this.findTaskCheckpointBy(task.taskId, "queued");
    if (foundCheckpoint) {
      const checkpointIndex =
        this.#taskCheckpoint.queued.indexOf(foundCheckpoint);
      this.#taskCheckpoint.queued.splice(checkpointIndex, 1);
    } else {
      console.warn(
        `Unable to remove task ${task.taskId} from checkpoint queued`
      );
    }

    // add task checkpoint to checkpoint canceled
    const taskCheckpoint = task.toJson();
    this.#taskCheckpoint.canceled.unshift(taskCheckpoint);
  }

  /**
   * Update a task
   *
   * @param {M3U8DownloadTask} task
   * @returns
   */
  queueTaskUpdated(task) {
    const foundCheckpoint = this.findTaskCheckpointBy(task.taskId, "queued");
    if (!foundCheckpoint) {
      console.warn(
        `Unable to update task ${task.taskId}, task not found in checkpoint queued`
      );
      return;
    }

    const checkpointIndex =
      this.#taskCheckpoint.queued.indexOf(foundCheckpoint);
    const taskCheckpoint = task.toJson();

    // remove old checkpoint and insert new checkpoint
    this.#taskCheckpoint.queued.splice(checkpointIndex, 1, taskCheckpoint);
  }

  registerListenerToTask(downloadTask) {
    downloadTask.on(M3U8DownloadTask.EventTypes.Begin, (task) => {
      console.log(`Downloader begin ${task.taskId}`);
      this.queueTaskUpdated(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Progress, (task, progress) => {
      // console.log(`Download task ${task.taskId} progress`, progress);
      this.queueTaskUpdated(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Pause, (task) => {
      console.log(`Download task ${task.taskId} paused`);
      this.queueTaskUpdated(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Resume, (task) => {
      console.log(`Download task ${task.taskId} resumed`);
      this.queueTaskUpdated(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Canceled, (task) => {
      console.log(`Download task ${task.taskId} canceled`);
      this.queueMoveTaskToCanceled(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Error, (task, error) => {
      console.log(`Download task ${task.taskId} error`, error);
      this.queueTaskUpdated(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.MergingFiles, (task) => {
      console.log(`Download task ${task.taskId} begin merging video segments`);
      this.queueTaskUpdated(task);
    });

    downloadTask.on(
      M3U8DownloadTask.EventTypes.MerginFilesCompleted,
      (task) => {
        console.log(
          `Download task ${task.taskId} merging video segments completed`
        );
        this.queueTaskUpdated(task);
      }
    );

    downloadTask.on(
      M3U8DownloadTask.EventTypes.ConvertingVideo,
      (task, inputFilePath) => {
        console.log(
          `Download task ${task.taskId} converting video file ${inputFilePath}`
        );
        this.queueTaskUpdated(task);
      }
    );

    downloadTask.on(
      M3U8DownloadTask.EventTypes.ConvertingVideoCompleted,
      (task, outputFilePath) => {
        console.log(
          `Download task ${task.taskId} converting video file completed ${outputFilePath}`
        );
        this.queueTaskUpdated(task);
      }
    );

    downloadTask.on(M3U8DownloadTask.EventTypes.Completed, (task, report) => {
      console.log(`Download task ${task.taskId} completed`);
      this.queueMoveTaskToCompleted(task);
    });
  }
}
