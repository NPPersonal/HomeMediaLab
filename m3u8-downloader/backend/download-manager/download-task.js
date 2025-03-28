import EventEmitter from "eventemitter3";
import { v4 as uuidv4 } from "uuid";
import { dateTimeLog } from "./libs/utils.js";

export const getTaskEventTypes = () => {
  return {
    /** (task)=>void */
    Init: "init",
    /** (task)=>void */
    Start: "start",
    /** (task)=>void */
    Pause: "pause",
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

export const getTaskStateTypes = () => {
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

  //#region Getter Setter
  /**
   *
   * Return this task's id
   */
  get taskId() {
    return this._taskId;
  }

  /**
   *
   * Set task id
   */
  set taskId(id) {
    this._taskId = id;
  }

  /**
   *
   * Return task's status
   */
  get status() {
    return this._status;
  }

  /**
   *
   * Return true if task is running otherwise false
   */
  get isRunning() {
    if (
      this.stateStack.includes(DownloadTask.StateTypes.Completed) ||
      this.stateStack.includes(DownloadTask.StateTypes.Canceled)
    ) {
      return false;
    }

    return [
      this.status === DownloadTask.StateTypes.Start,
      this.status === DownloadTask.StateTypes.PreProcessing,
      this.status === DownloadTask.StateTypes.Downloading,
      this.status === DownloadTask.StateTypes.PostProcessing,
    ].includes(this.stateStack.at(-1));
  }

  /**
   *
   * Return event logs as array
   */
  get eventLogs() {
    return this._eventLogs;
  }

  /**
   *
   * Return error logs as array
   */
  get errorLogs() {
    return this._errorLogs;
  }

  /**
   *
   * Return state stack
   */
  get stateStack() {
    return this._stateStack;
  }
  //#endregion Getter Setter

  //#endregion Setter

  //#region Constructor
  constructor() {
    super();

    this._taskId = undefined;
    this._status = DownloadTask.StateTypes.Unknown;
    this._eventLogs = [];
    this._stateStack = [];
    this._errorLogs = [];

    this.registerEventListeners();
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
      this.taskId = uuidv4();
    } else {
      this.taskId = taskId;
    }

    return this;
  }

  /**
   * Start the task asynchronously
   */
  async start() {
    try {
      //start only when task is not running or in Resume status
      if (
        !this.isRunning ||
        this.stateStack.at(-1) === DownloadTask.StateTypes.Pause
      ) {
        this.changeStatus(DownloadTask.StateTypes.Start, () => {
          this.addEventLog("Start");
          this.emit(DownloadTask.EventTypes.Start, this);
        });
        await this.doStart();

        if (!this.isRunning) return;
        this.changeStatus(DownloadTask.StateTypes.PreProcessing, () => {
          this.addEventLog("Pre Proccessing");
          this.emit(DownloadTask.EventTypes.PreProcessing, this);
        });
        await this.doPreProcessing();

        if (!this.isRunning) return;
        this.changeStatus(DownloadTask.StateTypes.Downloading, () => {
          this.addEventLog("Downloading");
          this.emit(DownloadTask.EventTypes.Downloading, this);
        });
        await this.doProcessing();

        if (!this.isRunning) return;
        this.changeStatus(DownloadTask.StateTypes.PostProcessing, () => {
          this.addEventLog("Post processing");
          this.emit(DownloadTask.EventTypes.PostProcessing, this);
        });
        await this.doPostProcessing();

        if (!this.isRunning) return;
        this.changeStatus(DownloadTask.StateTypes.Completed, () => {
          this.addEventLog("Task completed");
          this.emit(DownloadTask.EventTypes.Completed, this);
        });
        await this.doComplete();
      } else {
        console.warn(
          `Unable to start task as it is running, status: ${this.status}`,
          this.stateStack
        );
      }
    } catch (error) {
      this.changeStatus(DownloadTask.StateTypes.Error, () => {
        console.log(error);
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
   * Pause the task asynchronously
   */
  async pause() {
    if (!this.isRunning) return;

    this.changeStatus(DownloadTask.StateTypes.Pause, () => {
      this.addEventLog("Pause");
      this.emit(DownloadTask.EventTypes.Pause, this);
    });
    await this.doPause();
  }

  /**
   * Resume the task asynchronously
   */
  async resume() {
    if (this.status !== DownloadTask.StateTypes.Pause) return;
    await this.doResume();
  }

  /**
   * Cancel the task asynchronously
   */
  async cancel() {
    if (
      [
        DownloadTask.StateTypes.Completed,
        DownloadTask.StateTypes.Canceled,
      ].includes(this.status)
    )
      return;

    this.changeStatus(DownloadTask.StateTypes.Canceled, () => {
      this.addEventLog("Canceled");
      this.emit(DownloadTask.EventTypes.Canceled, this);
    });
    await this.doCancel();
  }

  /**
   * Add an event log to log array
   *
   * @param {string} message
   * @return log in string
   */
  addEventLog(message) {
    const log = dateTimeLog(message);
    this.eventLogs.push(log);
    return log;
  }

  serializeToJSON() {
    const jsonData = {};

    Object.getOwnPropertyNames(this).forEach((key) => {
      jsonData[key] = this[key];
    });

    return jsonData;
  }

  static deserializeFromJSON(jsonData) {
    return Object.create(
      DownloadTask.prototype,
      Object.getOwnPropertyDescriptors(jsonData)
    );
  }
  //#endregion Public methods

  //#region Protected methods
  /**
   * Change task's status and push new state to state stack
   *
   * @param {DownloadTask.StateTypes} newStatus new status to change to
   * @param {()=>void} callback callback that will be called after status have been changed
   */
  changeStatus(newStatus, callback = undefined) {
    const oldStatus = this.status;

    this._status = newStatus;

    if (this._stateStack.length === 0) {
      this._stateStack.push(this.status);
    } else if (this._stateStack[this.stateStack.length - 1] !== this.status) {
      this._stateStack.push(this.status);
    }

    this.emit(DownloadTask.EventTypes.StatusChanged, oldStatus, this.status);

    if (callback) callback();
  }

  /**
   * Overridable
   *
   * Call after task enter `PreProcessing` status
   */
  async doPreProcessing() {}

  /**
   * Overridable
   *
   * Call after task enter `Processing` status
   */
  async doProcessing() {}

  /**
   * Overridable
   *
   * Call after task enter `PostProcessing` status
   */
  async doPostProcessing() {}

  /**
   * Overridable
   *
   * Call after task enter `Start` status
   */
  async doStart() {}

  /**
   * Overridable
   *
   * Call after task enter `Canceled` status
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
   * Call when task resume
   */
  async doResume() {}

  /**
   * Overridable
   *
   * Call after task enter `Completed` status
   */
  async doComplete() {}
  //#endregion Protected methods

  //#region Private methods
  registerEventListeners() {
    this.on(DownloadTask.EventTypes.Error, (task, error) => {
      this.errorLogs.push(`Error: ${error.message}`);
    });
  }
  //#endregion Private methods
}
