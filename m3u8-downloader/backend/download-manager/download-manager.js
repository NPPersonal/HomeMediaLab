import fs from "fs-extra";
import { Observable } from "object-observer";
import { M3U8DownloadTask } from "./download-task.js";

const DATA_FILE_PATH = "task-checkpoints.json";

const CheckPointQueueNames = ["queued", "completed", "canceled"];
const DefaultCheckpoint = {
  queued: [],
  completed: [],
  canceled: [],
};

/**
 * Download manager that can handle multiple download tasks in queue.
 *
 * This manager responsible for:
 * - Adding task to queue
 * - Managing tasks queue
 * - Listening to tasks' events and handling events
 * - Writing tasks' checkpoint to json file
 * - Recreate tasks from checkpoint
 * - Providing interface for controlling a specific task by task's id
 * - Manage instance of manager
 *
 * Manager can write task's checkpoint to disk as json file then
 * load it back to queue. This is for case that manager crash or got
 * shutdown without losing each download task's state.
 *
 * Usage:
 *
 * The manager can only be one instance in an app thus you only need to
 * get manager instance by doing `DownloadManager.manager` which will create
 * an instance if not exists and return it or return the existing instance.
 *
 * Calling `init()` on instance to initialize the manager before using it. Any
 * subsequent call to `init()` will not do anything if the manager is initialized.
 */
export default class DownloadManager {
  //#region  Private fields
  /**
   * Global instance
   */
  static #_instance;

  /**
   * Whether the manager is initialized or not
   */
  #isInitialized = false;

  /**
   * A queue contain download task
   */
  #taskQueue = [];

  /**
   * Checkpoints for tasks
   */
  #taskCheckpoint = undefined;
  //#endregion Private fields

  //#region  Constructor
  /**
   * Create an instance of manager
   *
   */
  constructor() {
    this.#taskCheckpoint = this.loadCheckpoint(DATA_FILE_PATH);
  }
  //#endregion Constructor

  //#region Class methods
  /**
   * Return the single instance of manager
   *
   * Call `init()` to initialize manager before using the manager
   */
  static get manager() {
    if (DownloadManager.#_instance) return DownloadManager.#_instance;
    DownloadManager.#_instance = new DownloadManager();
    return DownloadManager.#_instance;
  }
  //#endregion Class methods

  //#region  Public methods
  /**
   * Initialize the manager
   *
   * @returns manager instance
   */
  init() {
    // don't initialize manager if it was initialized;
    if (this.#isInitialized) return this;

    // load task from checkpoint and add to queue
    this.#taskCheckpoint.queued.forEach((checkpoint) => {
      // create task from checkpoint
      const task = new M3U8DownloadTask(checkpoint.taskId).init(
        checkpoint.m3u8Url,
        checkpoint.output,
        checkpoint.workingDir,
        checkpoint.options
      );

      this.queueAddTask(task);

      // if task was running then run task
      if (checkpoint.isRunning) {
        this.startTaskBy(task.taskId);
      }
    });

    // observe task checkpoint data change and write
    // data to json file
    Observable.observe(this.#taskCheckpoint, (changes) => {
      try {
        fs.writeJsonSync(DATA_FILE_PATH, this.#taskCheckpoint);

        // changes.forEach((change) => {
        //   console.log(
        //     `write to json file ${change.type}`,
        //     change.type === "insert" || change.type === "update"
        //       ? change.value.progress
        //       : 0
        //   );
        // });
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
   * Add a task to the manager
   *
   * @param {M3U8DownloadTask} task
   */
  addTask(task) {
    return this.queueAddTask(task);
  }

  /**
   * Remove a task checkpoint from canceled queue
   * @param {string} taskId
   */
  removeTaskFromCanceled(taskId) {
    this.queueRemoveTaskFromCanceledBy(taskId);
  }

  /**
   * Remove task checkpoint from completed queue
   *
   * @param {string} taskId
   */
  removeTaskFromCompleted(taskId) {
    this.queueRemoveTaskFromCompletedBy(taskId);
  }
  //#endregion Public methods

  //#region  Private methods
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
   * @param {string} inQueue name of queue `queued`, `completed`, `canceled`
   * @returns checkpoint as an Object
   */
  findTaskCheckpointBy(taskId, inQueue) {
    if (!CheckPointQueueNames.includes(inQueue))
      throw new Error(
        `inQueue name: ${inQueue} is not matched in ${CheckPointQueueNames}`
      );

    const foundCheckpoint = this.#taskCheckpoint[inQueue].find((checkpoint) => {
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

    // add task's checkpoint to checkpoint queued
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

  /**
   * Remove task checkpoint from canceled
   *
   * @param {string} taskId
   * @returns
   */
  queueRemoveTaskFromCanceledBy(taskId) {
    const foundCheckpoint = this.findTaskCheckpointBy(taskId, "canceled");
    if (!foundCheckpoint) {
      console.warn(`Unable to fond task ${taskId} from canceled checkpoint`);
      return;
    }

    //remove task checkpoint from canceled
    const checkpointIndex =
      this.#taskCheckpoint.canceled.indexOf(foundCheckpoint);
    this.#taskCheckpoint.canceled.splice(checkpointIndex, 1);
  }

  /**
   * Remove task checkpoint from completed
   *
   * @param {string} taskId
   * @returns
   */
  queueRemoveTaskFromCompletedBy(taskId) {
    const foundCheckpoint = this.findTaskCheckpointBy(taskId, "completed");
    if (!foundCheckpoint) {
      console.warn(`Unable to find task ${taskId} from completed checkpoint`);
      return;
    }

    //remove task checkpoint from completed
    const checkpointIndex =
      this.#taskCheckpoint.completed.indexOf(foundCheckpoint);
    this.#taskCheckpoint.completed.splice(checkpointIndex, 1);
  }

  /**
   * Load checkpoint
   *
   * @param {string} filePath path to checkpoint json file
   * @returns an Observable checkpoint
   */
  loadCheckpoint(filePath) {
    // load checkpoint json file if json file exists
    // otherwise create one
    if (fs.pathExistsSync(filePath)) {
      return Observable.from(fs.readJsonSync(filePath));
    } else {
      const observableCheckpoint = Observable.from(DefaultCheckpoint);
      fs.writeJSONSync(filePath, observableCheckpoint);

      return observableCheckpoint;
    }
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
  //#endregion Private methods
}
