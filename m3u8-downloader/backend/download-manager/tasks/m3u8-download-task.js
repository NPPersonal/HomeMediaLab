import path from "node:path";
import M3U8Downloader from "../../modules/m3u8-downloader/src/index.js";
import { DefaultOptions } from "../../modules/m3u8-downloader/src/types.js";
import { DownloadTask } from "../download-task.js";

/**
 * M3U8DownloadTask is inherited from `DownloadTask` class.
 * M3U8DownloadTask is also a wrapper for `M3U8Downloader`
 * which responsible for downloading video segments from .m3u8 file.
 *
 * This task responsible for:
 * - Create an instance of `M3U8Downloader`
 * - Listening to `M3U8Downloader` events and handling events
 * - Emitting events
 * - Provide interface for controlling `M3U8Downloader`
 * - Manage task state
 *
 * Usage:
 *
 * Create an instance of `M3U8DownloadTask` then
 * call `init()` on the instance and provide requiried arguments
 */
export class M3U8DownloadTask extends DownloadTask {
  //#region Class event types
  static EventTypes = {
    /** Listener: (M3U8DownloadTask) => void */
    Init: "init",
    /** Listener: (M3U8DownloadTask) => void */
    Pending: "pending",
    /** Listener: (M3U8DownloadTask) => void */
    Begin: "begin",
    /** Listener: (M3U8DownloadTask) => void */
    Pause: "pause",
    /** Listener: (M3U8DownloadTask) => void */
    Resume: "resume",
    /** Listener: (M3U8DownloadTask) => void */
    Canceled: "canceled",
    /** Listener: (M3U8DownloadTask, progress) => void
     * 
     * `progress`: 
     * ```
     * {
        url: m3u8 .ts file url,
        filePath: file path to downloaded .ts file,
        progress: progress in float from 0 ~ 1,
        progressDesc: progress description,
       }
        ```
    */
    Progress: "downloading",

    /** Listener: (M3U8DownloadTask) => void */
    MergingFiles: "merging_files",
    /** Listener: (M3U8DownloadTask, mergedFilePath) => void
     *
     * `mergedFilePath`: path to merged file
     */
    MerginFilesCompleted: "merging_files_completed",
    /** Listener: (M3U8DownloadTask, inputFilePath) => void
     *
     * `inputFilePath`: path to input file(merged file)
     */
    ConvertingVideo: "converting_video",
    /** Listener: (M3U8DownloadTask, outputFilePath) => void
     *
     * `outputFilePath`: path to output file
     */
    ConvertingVideoCompleted: "converting_video_completed",
    /** Listener: (M3U8DownloadTask, error) => void
     *
     * `error`: Error
     */
    Error: "error",
    /** Listener: (M3U8DownloadTask, reportStr) => void
     *
     * `reportStr`: report in string
     */
    Completed: "completed",
  };
  //#endregion Class event types

  //#region Class states
  static States = Object.assign(this.EventTypes, {});
  //#endregion Class states

  //#region Getter
  /**
   * Getter
   *
   * Get task status
   *
   * @return status
   */
  get status() {
    return this._status;
  }

  /**
   * Getter
   *
   * Get task cehckpoint
   *
   * @return checkpoint as Object
   */
  get checkpoint() {
    return this._checkpoint ? this._checkpoint : {};
  }
  //#endregion Getter

  //#region Setter
  /**
   * Setter
   *
   * Merge checkpoint with given checkpoint object
   *
   * @param {Object} newCheckpoint an Object
   */
  set checkpoint(newCheckpoint) {
    if (newCheckpoint.constructor.name !== "Object") {
      throw new Error(
        "Fail to set task's checkpoint, checkpoint value must be an Object"
      );
    }

    if (newCheckpoint)
      this._checkpoint = Object.assign(this.checkpoint, newCheckpoint);
  }
  /**
   * Setter for status
   *
   * Also save status to checkpoint
   *
   * @param {string} newStatus
   */
  set status(newStatus) {
    this._status = newStatus;
    this.checkpoint = Object.assign(this.checkpoint, {
      status: this.status,
    });
  }

  /**
   * Setter for progress
   *
   * Save progress to checkpoint
   *
   * @param {number} newProgress
   */
  set progress(newProgress) {
    this.checkpoint = Object.assign(this.checkpoint, {
      progress: newProgress,
    });
  }

  /**
   * Setter
   *
   * Save a number of total downloaded files to checkpoint
   *
   * @param {number} num
   */
  set downloaded(num) {
    this.checkpoint = Object.assign(this.checkpoint, {
      downloaded: num,
    });
  }

  /**
   * Setter
   *
   * Save a number of total download failed fiels to checkpoint
   *
   * @param {number} num
   */
  set downloadFailed(num) {
    this.checkpoint = Object.assign(this.checkpoint, {
      downloadFailed: num,
    });
  }

  /**
   * Setter
   *
   * Save event logs
   *
   * @param {[string]} logs
   */
  set eventLogs(logs) {
    this.checkpoint = Object.assign(this.checkpoint, { eventLogs: logs });
  }
  //#endregion Setter

  //#region Constructor
  /**
   * Create a M3U8DownloadTask instance
   *
   * Call `init()` on instance to initialize the task
   * before using it
   *
   * @param {string} taskId id for the task, it will
   * generate an id for the task if not given
   */
  constructor(taskId = undefined) {
    super(taskId);
  }
  //#endregion Constructor

  //#region Public overrided methods
  async start() {
    if (!this.isRunning) this.downloader.download();
  }

  async pause() {
    this.downloader.pause();
  }

  async resume() {
    this.downloader.resume();
  }

  async cancel() {
    this.downloader.cancel();
  }

  toJson() {
    const checkPoint = Object.assign(super.toJson(), this.checkpoint);
    return checkPoint;
  }
  //#endregion Public overrided methods

  //#region Public methods
  /**
   * Initialize download task
   *
   * - Create a task id
   * - Create a M3U8Downloader instance
   *
   * @param {string} m3u8Url url to m3u8 file
   * @param {string} output output directory for video
   * @param {string} workingDir task's working directory e.g `./tmp`,
   * the actual working directory will be `workingDir/{taskId}`
   * @param {DefaultOptions} options options will passed to M3U8Downloader
   * @param {string} status task's status only for recovery
   * @param {string} downloaderStatus downloader's status only for recovery
   */
  init(
    m3u8Url,
    output,
    workingDir,
    options = { convert2Mp4: true },
    status = undefined,
    downloaderStatus = undefined
  ) {
    this.status = status ? status : M3U8DownloadTask.States.Init;
    this.emit(M3U8DownloadTask.EventTypes.Init);

    options = Object.assign(options, {
      segmentsDir: path.join(workingDir, this.taskId),
    });
    this.downloader = new M3U8Downloader(
      m3u8Url,
      output,
      options,
      downloaderStatus
    );
    this.checkpoint = {
      status: this.status,
      downloaderStatus: this.downloader.status,
      m3u8Url,
      output,
      workingDir,
      progress: 0,
      downloaded: 0,
      downloadFailed: 0,
      options: this.downloader.options,
    };
    this.registerEventListeners();
    this.status = M3U8DownloadTask.States.PENDING;
    this.emit(M3U8DownloadTask.EventTypes.PENDING);

    return this;
  }

  //#endregion Public methods

  //#region Private methods
  registerEventListeners() {
    this.downloader.on(
      M3U8Downloader.EventTypes.StatusChanged,
      (oldStatus, newStatus) => {
        this.checkpoint = Object.assign(this.checkpoint, {
          downloaderStatus: newStatus,
        });
      }
    );
    this.downloader.on(M3U8Downloader.EventTypes.Start, () => {
      this.status = M3U8DownloadTask.States.Begin;
      this.isRunning = true;
      this.eventLogs = this.downloader.eventLogs;
      this.emit(M3U8DownloadTask.EventTypes.Begin, this);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Pause, () => {
      this.status = M3U8DownloadTask.States.Pause;
      this.isRunning = false;
      this.eventLogs = this.downloader.eventLogs;
      this.emit(M3U8DownloadTask.EventTypes.Pause, this);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Resume, () => {
      this.status = M3U8DownloadTask.States.Resume;
      this.isRunning = true;
      this.eventLogs = this.downloader.eventLogs;
      this.emit(M3U8DownloadTask.EventTypes.Resume, this);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Canceled, () => {
      this.status = M3U8DownloadTask.States.Canceled;
      this.isRunning = false;
      this.eventLogs = this.downloader.eventLogs;
      this.emit(M3U8DownloadTask.EventTypes.Canceled, this);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Progress, (progress) => {
      const progressFloat = parseFloat(progress.downloaded / progress.total);
      const progressDesc = `${parseInt(progressFloat * 100.0)}%`;

      if (this.isRunning) {
        this.status = M3U8DownloadTask.States.Progress;
      }
      this.progress = progressFloat;
      this.downloaded = this.downloader.downloadedSegments;

      const progressObj = {
        url: progress.url,
        filePath: progress.downloadedFile,
        progress: progressFloat,
        progressDesc: progressDesc,
      };
      this.emit(M3U8DownloadTask.EventTypes.Progress, this, progressObj);
    });
    this.downloader.on(M3U8Downloader.EventTypes.BeginMerge, () => {
      this.status = M3U8DownloadTask.States.MergingFiles;
      this.eventLogs = this.downloader.eventLogs;
      this.emit(M3U8DownloadTask.EventTypes.MergingFiles, this);
    });
    this.downloader.on(
      M3U8Downloader.EventTypes.MergeCompleted,
      (mergedFilePath) => {
        this.status = M3U8DownloadTask.States.MerginFilesCompleted;
        this.eventLogs = this.downloader.eventLogs;
        this.emit(
          M3U8DownloadTask.EventTypes.MerginFilesCompleted,
          this,
          mergedFilePath
        );
      }
    );
    this.downloader.on(
      M3U8Downloader.EventTypes.BeginConversion,
      (inputFilePath) => {
        this.status = M3U8DownloadTask.States.ConvertingVideo;
        this.eventLogs = this.downloader.eventLogs;
        this.emit(
          M3U8DownloadTask.EventTypes.ConvertingVideo,
          this,
          inputFilePath
        );
      }
    );
    this.downloader.on(
      M3U8Downloader.EventTypes.ConversionCompleted,
      (outputFilePath) => {
        this.status = M3U8DownloadTask.States.ConvertingVideoCompleted;
        this.eventLogs = this.downloader.eventLogs;
        this.emit(
          M3U8DownloadTask.EventTypes.ConvertingVideoCompleted,
          this,
          outputFilePath
        );
      }
    );
    this.downloader.on(M3U8Downloader.EventTypes.Error, (error) => {
      this.status = M3U8DownloadTask.States.Error;
      this.downloadFailed = this.downloader.downloadFailedSegments;
      this.eventLogs = this.downloader.eventLogs;
      this.emit(M3U8DownloadTask.EventTypes.Error, this, error);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Completed, (report) => {
      this.status = M3U8DownloadTask.States.Completed;
      this.isRunning = false;
      this.eventLogs = this.downloader.eventLogs;
      if (!this.downloader.options.interruptOnError) {
        this.progress = 1.0;
      }
      let jsonString = JSON.stringify(report, null, 4);

      this.emit(M3U8DownloadTask.EventTypes.Completed, this, jsonString);
    });
  }
  //#endregion Private methods
}
