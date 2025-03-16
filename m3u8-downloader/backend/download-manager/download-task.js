import EventEmitter from "eventemitter3";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";
import M3U8Downloader from "../modules/m3u8-downloader/src/index.js";
import { DefaultOptions } from "../modules/m3u8-downloader/src/types.js";

export class M3U8DownloadTask extends EventEmitter {
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
    Progress: "progress",
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
  static States = Object.assign(this.EventTypes, {});

  /** Private field of task id */
  #taskId;

  /**
   * Create a M3U8DownloadTask instance
   *
   * Call `init()` on instance to initialize the task
   * before using it
   */
  constructor() {
    super();
  }

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
   */
  init(m3u8Url, output, workingDir, options = { convert2Mp4: true }) {
    this.status = M3U8DownloadTask.States.INIT;
    this.emit(M3U8DownloadTask.EventTypes.INIT);
    this.#taskId = uuidv4();
    options = Object.assign(options, {
      segmentsDir: path.join(workingDir, this.#taskId),
    });
    this.downloader = new M3U8Downloader(m3u8Url, output, options);
    this.registerEventListeners();
    this.status = M3U8DownloadTask.States.PENDING;
    this.emit(M3U8DownloadTask.EventTypes.PENDING);
  }

  /**
   * Return this task's id
   */
  get id() {
    return this.#taskId;
  }

  async start() {
    return this.downloader.download();
  }

  registerEventListeners() {
    this.downloader.on(M3U8Downloader.EventTypes.Start, () => {
      this.status = M3U8DownloadTask.States.Begin;
      this.emit(M3U8DownloadTask.EventTypes.Begin, this);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Pause, () => {
      this.status = M3U8DownloadTask.States.Pause;
      this.emit(M3U8DownloadTask.EventTypes.Pause, this);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Resume, () => {
      this.status = M3U8DownloadTask.States.Resume;
      this.emit(M3U8DownloadTask.EventTypes.Resume, this);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Canceled, () => {
      this.status = M3U8DownloadTask.States.Canceled;
      this.emit(M3U8DownloadTask.EventTypes.Canceled, this);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Progress, (progress) => {
      const progressFloat = parseFloat(progress.downloaded / progress.total);
      const progressDesc = `${parseInt(progressFloat * 100.0)}%`;
      const progressObj = {
        url: progress.url,
        filePath: progress.downloadedFile,
        progress: progressFloat,
        progressDesc: progressDesc,
      };
      this.emit(M3U8DownloadTask.EventTypes.Progress, this, progressObj);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Merging, () => {});
    this.downloader.on(
      M3U8Downloader.EventTypes.Merged,
      (mergedFilePath) => {}
    );
    this.downloader.on(
      M3U8Downloader.EventTypes.Converting,
      (inputFilePath) => {}
    );
    this.downloader.on(
      M3U8Downloader.EventTypes.Converted,
      (outputFilePath) => {}
    );
    this.downloader.on(M3U8Downloader.EventTypes.Error, (error) => {
      this.status = M3U8DownloadTask.States.Error;
      this.emit(M3U8DownloadTask.EventTypes.Error, this, error);
    });
    this.downloader.on(M3U8Downloader.EventTypes.Completed, (report) => {
      this.status = M3U8DownloadTask.States.Completed;
      let jsonString = JSON.stringify(report, null, 4);
      //   const configs = JSON.stringify(this.downloader.options, null, 4);
      //   const logs = JSON.stringify(report.eventLogs, null, 4);

      //   let reportStr = ```
      //     m3u8 url: ${report.url}
      //     output file path: ${report.output}
      //     total files need to be downloaded: ${report.totalSegments}
      //     successful downloaded files: ${report.downloadedSegments}
      //     fail downloaded files: ${report.downloadFailedSegments}
      //     downloader configs: ${configs}
      //     event logs:
      //     ${logs}
      //     ```;
      this.emit(M3U8DownloadTask.EventTypes.Completed, this, jsonString);
    });
  }
}
