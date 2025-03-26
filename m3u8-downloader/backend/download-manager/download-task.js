import EventEmitter from "eventemitter3";
import { v4 as uuidv4 } from "uuid";
import { dateTimeLog } from "./libs/utils.js";

const getTaskEventTypes = () => {
  return {
    /** (task)=>void */
    Init: "init",
    /** (task)=>void */
    Pending: "pending",
    /** (task)=>void */
    Start: "start",
    /** (task)=>void */
    Pause: "pause",
    /** (task)=>void */
    Resume: "resume",
    /** (task)=>void */
    Canceled: "canceled",
    /** (task)=>void */
    PreProcessing: "pre-processing",
    /** (task)=>void */
    Downloading: "downloading",
    /** (task)=>void */
    PostProcessing: "post-processing",
    /** (task)=>void */
    Completed: "completed",
    /** (task, Error)=>void */
    Error: "error",
    /** (oldStatus, newStatus)=>void */
    StatusChanged: "status-changed",
  };
};

const getTaskStateTypes = () => {
  const states = Object.assign({ Unknown: "unknown" }, getTaskEventTypes());
  delete states.StatusChanged;
  return states;
};

/**
 * Generic Download task to be inherited
 *
 * This class responsible for:
 * - Generate uuid for the task
 * - State that is running or not
 * - Provide task interface entry points for
 * `start`, `pause`, `resume`, `cancel` which subclas need to override
 * - Transforming the task to json object.
 */
export class DownloadTask extends EventEmitter {
  static EventTypes = getTaskEventTypes();

  static StateTypes = getTaskStateTypes();

  //#region Private fields
  /** Private field
   *
   * task id
   */
  #taskId;

  /**
   * Private field
   *
   * task status
   */
  #status = DownloadTask.StateTypes.Unknown;

  /** Private field
   *
   * array of string contain all even logs
   */
  #eventLogs = [];
  //#endregion Private fields

  //#region Getter
  /**
   * Getter
   *
   * Return this task's id
   */
  get taskId() {
    return this.#taskId;
  }

  /**
   * Getter
   *
   * Return task's status
   */
  get status() {
    return this.#status;
  }

  /**
   * Getter
   *
   * Return true if task is running otherwise false
   */
  get isRunning() {
    return (
      this.status === DownloadTask.StateTypes.Start ||
      this.status === DownloadTask.StateTypes.Resume ||
      this.status === DownloadTask.StateTypes.PreProcessing ||
      this.status === DownloadTask.StateTypes.Downloading ||
      this.status === DownloadTask.StateTypes.PostProcessing
    );
  }

  /**
   * Getter
   *
   * Return event logs as array
   */
  get evenLogs() {
    return this.#eventLogs;
  }
  //#endregion Getter

  //#region Setter
  /**
   * Setter
   *
   * Set task status
   */
  set status(newStatus) {
    this.#status = newStatus;
  }
  //#endregion Setter

  //#region Constructor
  constructor() {
    super();
  }

  //#endregion Constructor

  //#region Public methods
  /**
   * Initialize the task
   *
   * @param {string} taskId create new id for this task if `undefined`
   * @returns instance of the task
   */
  init(taskId = undefined) {
    this.changeStatus(DownloadTask.StateTypes.Init, () => {
      this.addEventLog("Task initializing");
      this.emit(DownloadTask.EventTypes.Init, this);
    });

    if (!taskId) {
      this.#taskId = uuidv4();
    } else {
      this.#taskId = taskId;
    }

    this.changeStatus(DownloadTask.StateTypes.Pending, () => {
      this.addEventLog("Task pending");
      this.emit(DownloadTask.EventTypes.Pending, this);
    });

    return this;
  }

  /**
   * Start the task asynchronously
   */
  async start() {
    try {
      if (!this.isRunning) {
        this.changeStatus(DownloadTask.StateTypes.Start, () => {
          this.addEventLog("Start");
          this.emit(DownloadTask.EventTypes.Start, this);
        });
        await this.doStart();

        this.changeStatus(DownloadTask.StateTypes.PreProcessing, () => {
          this.addEventLog("Pre Proccessing");
          this.emit(DownloadTask.EventTypes.PreProcessing, this);
        });
        await this.preProcessing();

        this.changeStatus(DownloadTask.StateTypes.Downloading, () => {
          this.addEventLog("Downloading");
          this.emit(DownloadTask.EventTypes.Downloading, this);
        });
        await this.processing();

        this.changeStatus(DownloadTask.StateTypes.PostProcessing, () => {
          this.addEventLog("Post processing");
          this.emit(DownloadTask.EventTypes.PostProcessing, this);
        });
        await this.postProcessing();

        await this.doComplete();
        this.changeStatus(DownloadTask.StateTypes.Completed, () => {
          this.addEventLog("Task completed");
          this.emit(DownloadTask.EventTypes.Completed, this);
        });
      }
    } catch (error) {
      this.changeStatus(DownloadTask.StateTypes.Error, () => {
        this.addEventLog(`Error: ${error.message}`);
        this.emit(
          DownloadTask.EventTypes.Error,
          this,
          new Error(`Task ${this.taskId} fail\n${error.message}`)
        );
      });
    }
  }

  /**
   * Pause the task
   */
  async pause() {
    if (!this.isRunning) return;

    this.changeStatus(DownloadTask.StateTypes.Pause, () => {
      this.addEventLog("Pause");
      this.emit(DownloadTask.EventTypes.Pause, this);
    });
    this.doPause();
  }

  /**
   * Resume the task
   */
  async resume() {
    if (this.status !== DownloadTask.StateTypes.Pause) return;

    this.changeStatus(DownloadTask.StateTypes.Resume, () => {
      this.addEventLog("Resume");
      this.emit(DownloadTask.EventTypes.Resume, this);
    });
    this.doResume();
  }

  /**
   * Cancel the task
   */
  async cancel() {
    this.doCancel();
    this.changeStatus(DownloadTask.StateTypes.Canceled, () => {
      this.addEventLog("Canceled");
      this.emit(DownloadTask.EventTypes.Canceled, this);
    });
  }

  /**
   * Get json object of this task
   * @returns a JSON object
   */
  toJson() {
    return { taskId: this.#taskId, status: this.status };
  }

  /**
   * Add an event log to log array
   *
   * @param {string} message
   * @return log in string
   */
  addEventLog(message) {
    const log = dateTimeLog(message);
    this.#eventLogs.push(log);
    return log;
  }
  //#endregion Public methods

  //#region Protected methods
  /**
   * Change task's status
   *
   * @param {DownloadTask.StateTypes} newStatus new status to change to
   * @param {()=>void} callback callback that will be called after status have been changed
   */
  changeStatus(newStatus, callback = undefined) {
    const oldStatus = this.#status;

    this.status = newStatus;
    this.emit(DownloadTask.EventTypes.StatusChanged, oldStatus, this.status);

    if (callback) callback();
  }
  /**
   * Overridable
   *
   * Call when start preprocessing
   */
  async preProcessing() {}

  /**
   * Overridable
   *
   * Call when start processing
   */
  async processing() {}

  /**
   * Overridable
   *
   * Call when start postprocessing
   */
  async postProcessing() {}

  /**
   * Overridable
   *
   * Call after task enter `Start` status
   */
  async doStart() {}

  /**
   * Overridable
   *
   * Call before task enter `Canceled` status
   */
  async doCancel() {}

  /**
   * Overridable
   *
   * Call after task enter `Pause` status
   */
  async doPause() {}

  /**
   * Overridable
   *
   * Call after task enter `Resume` status
   */
  async doResume() {}

  /**
   * Overridable
   *
   * Call before task enter `Completed` status
   */
  async doComplete() {}
  //#endregion Protected methods
}
