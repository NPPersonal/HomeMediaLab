import fs from "fs-extra";
import { Observable } from "object-observer";
import { M3U8DownloadTask } from "./tasks/m3u8-download-task.js";
import EventEmitter from "eventemitter3";

const CHECKPOINT_FILE_PATH = "task-checkpoints.json";

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
export default class DownloadManager extends EventEmitter {
  static CheckpointEventTypes = {
    /**
     * Listener: (data) => void
     *
     * Emit when checkpoint is inserted into queue
     */
    Insert: "insert",

    /**
     * Listener: (data) => void
     *
     * Emit when checkpoint deleted from queue
     */
    Delete: "delete",

    /**
     * Listener: (data) => void
     *
     * Emit when checkpoint updated in queue
     */
    Update: "update,",
  };

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

  //#region Getter Setter
  /**
   *
   * Return checkpoints
   *
   * @return task checkpoints
   */
  get checkpoints() {
    return this.#taskCheckpoint;
  }

  /**
   *
   * Return trasnsformed checkpoints
   */
  get transformedCheckpoints() {
    return this.transformCheckpoint(this.#taskCheckpoint);
  }
  //#endregion Getter Setter

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

  //#region  Constructor
  /**
   * Create an instance of manager
   *
   */
  constructor() {
    super();

    this.#taskCheckpoint = Observable.from(
      this.loadCheckpoint(CHECKPOINT_FILE_PATH)
    );
  }
  //#endregion Constructor

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
    const tasks = [];
    this.#taskCheckpoint.queued.forEach((checkpoint) => {
      // create task from checkpoint
      const task = M3U8DownloadTask.deserializeFromJSON(checkpoint);

      if (checkpoint.isRunning) {
        tasks.push({ isRunning: true, task: task });
      } else {
        tasks.push({ isRunning: false, task: task });
      }
    });

    tasks.forEach((value) => {
      this.queueAddTask(value.task);
      if (value.isRunning) {
        value.task.changeStatus(M3U8DownloadTask.StateTypes.Pause);
        // start task
        this.startTaskBy(value.task.taskId);
      }
    });

    // Observe changes of properties for task checkpoints
    if (this.#taskCheckpoint) {
      Object.keys(this.#taskCheckpoint).forEach((key) => {
        if (Observable.isObservable(this.#taskCheckpoint[key])) {
          // Observe top level of changing array not going deep
          Observable.observe(
            this.#taskCheckpoint[key],
            this.makeObservableCallback(key),
            { pathsOf: "" }
          );
        } else {
          log.warn(`Unable to observe ${key} of task checkpoint`);
        }
      });
    }

    this.#isInitialized = true;
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
   * Transform checkpoint data
   *
   * This perform deep transform **(recursive)** on checkpoint, if it
   * encounter an object then all keys in the object with
   * string start with underscore('_') will be replaced with no
   * underscore string e.g key `_name` transformed to `name`.
   *
   * Rest remain the same.
   *
   * @param {any} checkpoint
   * @return depend on what you passed in to `checkpoint`
   */
  transformCheckpoint = (checkpoint) => {
    // if checkpoint is an Object
    if (checkpoint instanceof Object && !Array.isArray(checkpoint)) {
      const newObj = {};

      Object.keys(checkpoint).forEach((key) => {
        let newKey = key;
        // remove underscore if key start with '_'
        if (newKey.startsWith("_")) {
          newKey = newKey.substring(1);
        }
        newObj[newKey] = this.transformCheckpoint(checkpoint[key]);
      });

      return newObj;
    } else if (checkpoint instanceof Object && Array.isArray(checkpoint)) {
      // if checkpoint is an Array
      const newArr = [];

      checkpoint.forEach((value, index) => {
        newArr[index] = this.transformCheckpoint(value);
      });

      return newArr;
    } else {
      // if checkpoint is neither an Object or an Array
      return checkpoint;
    }
  };

  /**
   * Transform observable change according to
   * https://github.com/gullerya/object-observer/blob/main/docs/observable.md
   *
   * @param {*} change change information
   * @returns as an Object
   * ```
   * {
   * operation: 'kind of operation as string',
   * in: 'checkpoint queue name as string',
   * at: 'index in the queue as number',
   * value: 'object that is associated with operation'
   * }
   * ```
   */
  transformObservalChange(change, inQueueName) {
    const index = change.path.at(-1);
    const queueName = inQueueName;

    // transform changed value
    const transformedValue = change.value
      ? this.transformCheckpoint(change.value)
      : this.transformCheckpoint(change.oldValue);

    return {
      operation: change.type,
      in: queueName,
      at: index,
      value: transformedValue,
    };
  }

  /**
   * Create an observer callback which take
   * observable changes.
   *
   * Callback that observe change on `update`, `insert`, `delete` then
   * do transformation on changes' value, finally emit event
   *
   * @param {string} queueName name of queue for the callback. name which
   * will be used when transform observal changes
   * @returns function callback `(changes)=>void`
   */
  makeObservableCallback(queueName) {
    return (changes) => {
      // write to json file
      fs.writeJsonSync(CHECKPOINT_FILE_PATH, this.#taskCheckpoint);

      changes.forEach((change) => {
        if (change.type === "update") {
          this.emit(
            DownloadManager.CheckpointEventTypes.Update,
            this.transformObservalChange(change, queueName)
          );
          return;
        }

        if (change.type === "insert") {
          this.emit(
            DownloadManager.CheckpointEventTypes.Insert,
            this.transformObservalChange(change, queueName)
          );
          return;
        }
        if (change.type === "delete") {
          this.emit(
            DownloadManager.CheckpointEventTypes.Delete,
            this.transformObservalChange(change, queueName)
          );
          return;
        }
      });
    };
  }

  /**
   * Find a download task by task's id in task queue
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
      return checkpoint._taskId === taskId;
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
    const taskCheckpoint = task.serializeToJSON();
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
    const taskCheckpoint = task.serializeToJSON();
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
    const taskCheckpoint = task.serializeToJSON();
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
    const taskCheckpoint = task.serializeToJSON();

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
   * @returns a JSON Object
   */
  loadCheckpoint(filePath) {
    // load checkpoint json file if json file exists
    // otherwise create one
    if (fs.pathExistsSync(filePath)) {
      return fs.readJsonSync(filePath);
    } else {
      fs.writeJSONSync(filePath, DefaultCheckpoint);

      return DefaultCheckpoint;
    }
  }

  registerListenerToTask(downloadTask) {
    downloadTask.on(M3U8DownloadTask.EventTypes.Start, (task) => {
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

    downloadTask.on(M3U8DownloadTask.EventTypes.Canceled, (task) => {
      console.log(`Download task ${task.taskId} canceled`);
      this.queueMoveTaskToCanceled(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Error, (task, error) => {
      console.log(`Download task ${task.taskId} error`, error);
      this.queueTaskUpdated(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Merging, (task) => {
      console.log(`Download task ${task.taskId} merging video segments`);
      this.queueTaskUpdated(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Converting, (task) => {
      console.log(`Download task ${task.taskId} converting video file`);
      this.queueTaskUpdated(task);
    });

    downloadTask.on(M3U8DownloadTask.EventTypes.Completed, (task) => {
      console.log(`Download task ${task.taskId} completed`);
      this.queueMoveTaskToCompleted(task);
    });
  }
  //#endregion Private methods
}
