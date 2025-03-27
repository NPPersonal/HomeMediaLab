import path from "node:path";
import {
  DownloadTask,
  getTaskEventTypes,
  getTaskStateTypes,
} from "../download-task.js";
import fs from "fs-extra";
import { spawn } from "node:child_process";
import axios from "axios";
import axiosRetry from "axios-retry";
import PQueue from "p-queue";
import * as m3u8Parser from "m3u8-parser";
import {
  isUrl,
  isValidFileExtension,
  getBaseURL,
  combineURL,
} from "../libs/utils.js";
import os from "node:os";

export const DefaultOptions = {
  /** How many concurrent download to run */
  concurrency: 5,
  /** Whether to convert segments to mp4 file or not,
   * if true then mergeSegments must be true otherwise
   * it will not do conversion
   */
  convert2Mp4: true,
  /** Whether to merge segements into single .ts file or not  */
  mergeSegments: true,
  /** Whether to remove .ts file source that was used for merging */
  deleteMergeSources: true,
  /** Directory to store .ts files default to OS tmp directory */
  segmentsDir: os.tmpdir(),
  /** How many time to retry when download fail */
  retries: 3,
  /** Path to FFMPEG excutable file */
  ffmpegPath: "ffmpeg",
  /** Whether to clean files in directory when job is done */
  clean: true,
  /** Start index for picking a range of .ts file to download default to 0 */
  startIndex: 0,
  /** End index for picking a range of .ts file to download default to undefined
   * which refer to end of .ts file url list
   */
  endIndex: undefined,
  /** Whether to skip download for a .ts file or not if it already exists  */
  skipExistSegments: false,
  /** Extra header key/value pair for http/https while requesting a .ts file from the url*/
  headers: {},
  /** If true then download/merging/conversion process will stop, otherwise it will continue */
  interruptOnError: false,
  /** Only use if given m3u8 file is a master file which contain other m3u8 files, default 0 */
  m3u8PlaylistIndex: 0,
};

export const DefaultProgress = {
  /** .ts file url */
  url: "",
  /** File path to .ts file */
  downloadedFile: "",
  /** Current download segment index */
  downloaded: 0,
  /** Total segmetns to be downloaded */
  total: 0,
};

const SUPPORT_OUTPUT_FILE_TYPES = [".mp4"];

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
  static EventTypes = Object.assign(
    {
      /**
       * (task, progress) => void
       * 
       * @param {DefaultProgress} progress an object
       * ```
       * {
          url: `url to .ts file(segment) as string`,
          downloadedFile: `path to .ts file as string`,
          downloaded: `current downloaded file index as number`,
          total: `total .ts files need to be downloaded as number`,
        }
          ```
       */
      Progress: "progress",
      /**
       * (task)=>void
       */
      Merging: "merging",
      /** (task)=>void */
      Converting: "converting",
    },
    getTaskEventTypes()
  );

  static StateTypes = Object.assign(
    { Merging: "merging", Converting: "converting" },
    getTaskStateTypes()
  );

  //#region Getter Setter
  /**
   *
   * Is this task running?
   *
   * Overrided from parent class
   */
  get isRunning() {
    let filterStates = [
      M3U8DownloadTask.StateTypes.Start,
      M3U8DownloadTask.StateTypes.Resume,
      M3U8DownloadTask.StateTypes.PreProcessing,
      M3U8DownloadTask.StateTypes.Downloading,
      M3U8DownloadTask.StateTypes.PostProcessing,
      M3U8DownloadTask.StateTypes.Merging,
      M3U8DownloadTask.StateTypes.Converting,
    ];

    if (!this.options.interruptOnError) {
      filterStates = [...filterStates, M3U8DownloadTask.StateTypes.Error];
    }

    return filterStates.includes(this.status);
  }

  /**
   *
   * Return task's progress 0 ~ 1
   */
  get progress() {
    return this._progress;
  }

  /**
   *
   * Set task's progress
   *
   * @param {number} newProgress progress value between 0 ~ 1
   * clamp value if it is not in 0 ~ 1
   */
  set progress(newProgress) {
    const pClamped = Math.max(0.0, Math.min(newProgress, 1.0));
    this._progress = pClamped;
  }

  /**
   *
   * Return how many video segment file has been downloaded
   * successful
   */
  get fileDownload() {
    return this._fileDownload;
  }

  /**
   *
   * Set how many video segment file has been downloaded
   * successful
   *
   * @param {number} num
   */
  set fileDownload(num) {
    this._fileDownload = num;
  }

  /**
   *
   * Return how many video segment file failed to be downloaded
   */
  get fileDownloadFail() {
    return this._fileDownloadFail;
  }

  /**
   *
   * Set how many video segment file failed to be downloaded
   *
   * @param {number} num
   */
  set fileDownloadFail(num) {
    this._fileDownloadFail = num;
  }
  //#endregion Getter Setter

  //#region Constructor
  constructor() {
    super();

    this._progress = 0.0;
    this._fileDownload = 0;
    this._fileDownloadFail = 0;
    this.queue = new PQueue();

    this.registerEventListeners();
  }
  //#endregion Constructor

  //#region Public overrided methods

  serializeToJSON() {
    const jsonData = {};
    const filters = ["_events", "_eventsCount"];

    Object.getOwnPropertyNames(this).forEach((key) => {
      if (!filters.includes(key)) jsonData[key] = this[key];
    });

    return jsonData;
  }

  static deserializeFromJSON(jsonData) {
    return Object.create(
      M3U8DownloadTask.prototype,
      Object.getOwnPropertyDescriptors(jsonData)
    );
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
  init(m3u8Url, output, workingDir, options = DefaultOptions) {
    super.init();

    this.options = Object.assign(
      { ...DefaultOptions, ...options },
      {
        segmentsDir: path.join(workingDir, this.taskId),
      }
    );
    this.m3u8Url = m3u8Url;
    // The playlistUrl is used to fetch playlist's segments,
    // default to m3u8Url but need to be changed when m3u8Url to m3u8 file
    // contain other playlists
    this.playlistUrl = this.m3u8Url;
    this.output = path.resolve(output);
    this.segmentsDir = this.options.segmentsDir;
    this.queue.concurrency = this.options.concurrency;
    this.totalSegments = 0;
    this.downloadedSegments = 0;
    this.downloadFailedSegments = 0;
    this.downloadedFiles = [];

    // Setup axio retry download
    axiosRetry(axios, {
      retries: this.options.retries,
      retryDelay: axiosRetry.exponentialDelay,
    });

    return this;
  }

  //#endregion Public methods

  //#region Override
  async doPause() {
    // running in queue will not be paused
    this.queue.pause();
  }

  async doResume() {
    if (this.queue.size === 0) {
      this.start();
      return;
    }
    this.queue.start();
  }

  async doCancel() {
    this.queue.clear();
  }

  async doPreProcessing() {
    // Make directory for download segments if it doesn't exists
    if (!(await fs.pathExists(this.segmentsDir))) {
      await fs.mkdir(this.segmentsDir, { recursive: true });
    }

    // Make directory for output if it dosen't exists
    if (this.options.convert2Mp4) {
      const outputDir = path.dirname(this.output);
      if (!(await fs.pathExists(outputDir))) {
        await fs.mkdir(outputDir, { recursive: true });
      }
    } else {
      console.warn(
        "output directory will not be created as conversion is disabled"
      );
    }

    // Fetch m3u8 file from url
    const m3u8Content = await this.getM3U8(this.m3u8Url, this.options.headers);

    // Parsing m3u8 content
    const tsUrls = await this.parseM3U8(
      m3u8Content,
      this.options.m3u8PlaylistIndex
    );

    // Get portion/range of tsUrls we want to download
    this.urls = tsUrls.slice(this.options.startIndex, this.options.endIndex);
    this.totalSegments = this.urls.length;
  }

  async doProcessing() {
    // Download .ts files
    await this.downloadTsSegments(this.urls);
  }

  async doPostProcessing() {
    // If downloaded .ts files need to be merged
    if (this.options.mergeSegments) {
      const tsMediaPath = await this.mergeTsSegments(
        this.totalSegments,
        this.options.deleteMergeSources
      );

      // If merged .ts file need to be convert to mp4
      if (this.options.convert2Mp4) {
        // Make sure output is valid string
        if (this.output) {
          //Make sure output file extension is valid
          if (isValidFileExtension(this.output, SUPPORT_OUTPUT_FILE_TYPES)) {
            await this.convertToMp4(tsMediaPath);
          } else {
            fs.unlinkSync(tsMediaPath);
            this.changeStatus(DownloadTask.StateTypes.Error, () =>
              this.emit(
                DownloadTask.EventTypes.Error,
                this,
                new Error(
                  `Unable to convert to mp4, output ${this.output} is not a valid file types\nSupported file types are: ${SUPPORT_OUTPUT_FILE_TYPES}`
                )
              )
            );
          }
        } else {
          fs.unlinkSync(tsMediaPath);
          this.changeStatus(DownloadTask.StateTypes.Error, () =>
            this.emit(
              DownloadTask.EventTypes.Error,
              this,
              new Error(
                `Unable to convert to mp4, output ${this.output} was not given`
              )
            )
          );
        }
      }
    }
  }

  async doComplete() {
    if (!this.isRunning) {
      await this.cleanUpDownloadedFiles();
      return;
    }
  }
  //#endregion Override

  //#region Private util methods
  /**
   * Fetch m3u8 content from url
   *
   * @param {string} m3u8Url url to m3u8 file
   * @param {{[key: string]:string}} extra_headers custom headers for http/https request, key/value pair
   * @returns m3u8 content
   */
  async getM3U8(m3u8Url, extra_headers = {}) {
    const { data: m3u8Content } = await axios.get(m3u8Url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
        ...extra_headers,
      },
    });
    return m3u8Content;
  }

  /**
   * Return .ts urls from the m3u8 content, if the m3u8 content
   * **do not** contain other m3u8 playlists
   *
   * If given m3u8 content contain other m3u8 playlists
   * then it will get the .ts urls from a specific m3u8 playlist
   * by `playlistIndex`
   *
   * @param {string} m3u8Content string in m3u8 format
   * @param {number} playlistIndex index of m3u8 playlist,
   * **only use if `m3u8Content` contain other m3u8 playlists**,
   * index will be fixed to 0 automatically if index is out of m3u8
   * playlists size,
   * default 0
   * @returns array of string as url
   */
  async parseM3U8(m3u8Content, playlistIndex = 0) {
    const parser = new m3u8Parser.Parser();

    parser.push(m3u8Content);
    parser.end();

    const parsedManifest = parser.manifest;

    // if this m3u8 content contain other playlists,
    // we will get the specific m3u8 playlist content by index
    if (parsedManifest?.playlists) {
      const playlists = parsedManifest.playlists.map((playlist) => {
        // only combine url with base m3u8 url if playlist's uri
        // is relative url
        const url = isUrl(playlist.uri)
          ? playlist.uri
          : combineURL(getBaseURL(this.m3u8Url), playlist.uri).href;

        return {
          url: url,
          resolution: playlist.attributes["RESOLUTION"],
          bandwidth: playlist.attributes["BANDWIDTH"],
          programId: playlist.attributes["PROGRAM-ID"],
        };
      });

      // fix playlist index to 0 if it is out of bound
      if (playlistIndex >= playlists.length) playlistIndex = 0;

      // get the specific m3u8 playlist file
      const playlist = playlists[playlistIndex];

      // since we selected a playlist then
      // we need to update playlistUrl to new playlist's url
      // instead of original m3u8Url
      this.playlistUrl = playlist.url;
      const m3u8Content = await this.getM3U8(
        playlist.url,
        this.options.headers
      );
      return await this.parseM3U8(m3u8Content, playlistIndex);
    }

    // parsing segments if m3u8 content is a playlist(actual m3u8 that include .ts file uri)
    return (parsedManifest?.segments || []).map((segment) => {
      if (isUrl(segment.uri)) {
        return segment.uri;
      } else {
        return new URL(segment.uri, this.playlistUrl).href;
      }
    });
  }

  /**
   * Start to download a bulk of .ts files from their urls
   *
   * @param {string[]} tsUrls
   * @returns
   */
  async downloadTsSegments(tsUrls) {
    for (const [index, tsUrl] of tsUrls.entries()) {
      this.queue
        .add(async () => {
          const p = await this.downloadSegment(tsUrl, index);
          this.fileDownload += 1;
          this.emit(M3U8DownloadTask.EventTypes.Progress, this, p);
        })
        .catch((error) => {
          this.downloadFailedSegments++;
          this.changeStatus(DownloadTask.StateTypes.Error, () => {
            this.fileDownloadFail += 1;
            this.emit(
              DownloadTask.EventTypes.Error,
              this,
              new Error(
                `Failed to download segment ${index}\nurl: ${tsUrl} \nreason: ${error}\n`
              )
            );
          });
        });
    }

    await this.queue.onIdle();
  }

  /**
   * Download a single .ts file
   *
   * @param {string} tsUrl url to .ts file
   * @param {number} index index of ts file
   * @returns
   */
  async downloadSegment(tsUrl, index) {
    if (!this.isRunning) return;

    const formattedIndex = String(index).padStart(5, "0");

    // Create segment path
    const segmentPath = path.resolve(
      this.segmentsDir,
      `segment${formattedIndex}.ts`
    );

    // If segment file exists and don't override it
    if (this.options.skipExistSegments && (await fs.pathExists(segmentPath))) {
      if (!this.downloadedFiles.includes(segmentPath))
        this.downloadedFiles.push(segmentPath);
      this.downloadedSegments++;
    } else {
      // Download the segment
      const response = await axios.get(tsUrl, {
        responseType: "arraybuffer",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
          ...this.options.headers,
        },
      });

      // Write the segment file to the path
      await fs.writeFile(segmentPath, response.data);
      this.downloadedFiles.push(segmentPath);
      this.downloadedSegments++;
    }

    const progress = Object.assign(DefaultProgress, {
      url: tsUrl,
      downloadedFile: segmentPath,
      downloaded: this.downloadedSegments,
      total: this.totalSegments,
    });

    return progress;
  }

  /**
   * Merge .ts files(segments) into a single .ts file
   *
   * @param {number} total total segments
   * @param {boolean} deleteSource whether to delete .ts file(segment) after
   * it is merged
   * @returns path to merged .ts file
   */
  async mergeTsSegments(total, deleteSource = true) {
    if (!this.isRunning) return;

    let mergedFilePath = path.resolve(this.segmentsDir, "output.ts");

    if (!this.options.convert2Mp4) {
      mergedFilePath = this.output;
    }

    // Create a writable file stream
    const writeStream = fs.createWriteStream(mergedFilePath);

    this.changeStatus(M3U8DownloadTask.StateTypes.Merging, () =>
      this.emit(M3U8DownloadTask.EventTypes.Merging, this)
    );

    for (let index = 0; index < total; index++) {
      if (!this.isRunning) {
        writeStream.end();
        return;
      }

      // Create segment file path
      const formattedIndex = String(index).padStart(5, "0");
      const segmentPath = path.resolve(
        this.segmentsDir,
        `segment${formattedIndex}.ts`
      );

      // Merge the segment
      try {
        const segmentData = await fs.readFile(segmentPath);
        writeStream.write(segmentData);

        // Whether to delete .ts source file after merged or not
        if (deleteSource) await fs.unlink(segmentPath); // 删除临时 TS 片段文件
      } catch (error) {
        this.changeStatus(DownloadTask.StateTypes.Error, () =>
          this.emit(
            DownloadTask.EventTypes.Error,
            this,
            new Error(
              `Segment ${index} is missing\nExpected file at path: ${segmentPath}\n${error}\n`
            )
          )
        );

        // Interrupt procedure while encounter error
        // otherwise continue merging process
        if (this.options.interruptOnError) {
          writeStream.end();
          return;
        }
      }
    }

    writeStream.end();
    return mergedFilePath;
  }

  /**
   * Convert merged .ts file into .mp4 file
   *
   * @param {string} mergedTSMediaPath path ot .ts merged file
   * @returns
   */
  async convertToMp4(mergedTSMediaPath) {
    if (!this.isRunning) return;

    const inputFilePath = mergedTSMediaPath;
    const outputFilePath = this.output;

    return new Promise((resolve, reject) => {
      this.changeStatus(M3U8DownloadTask.StateTypes.Converting, () =>
        this.emit(M3U8DownloadTask.EventTypes.Converting, this)
      );

      // Use ffmpeg to convert merged .ts file into .mp4
      // with command in a child process
      const ffmpeg = spawn(this.options.ffmpegPath, [
        "-i",
        inputFilePath,
        "-c",
        "copy",
        outputFilePath,
        "-y",
      ]);

      ffmpeg.on("error", (error) => {
        this.changeStatus(DownloadTask.StateTypes.Error, () =>
          this.emit(
            DownloadTask.EventTypes.Error,
            this,
            `Failed to convert to MP4: ${error.message}`
          )
        );
        reject(error);
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          this.changeStatus(DownloadTask.StateTypes.Error, () =>
            this.emit(
              DownloadTask.EventTypes.Error,
              this,
              `FFmpeg process exited with code ${code}`
            )
          );
          reject(new Error(`FFmpeg process exited with code ${code}`));
          return;
        }
        fs.unlinkSync(inputFilePath); // remove merged TS file
        resolve(outputFilePath);
      });
    });
  }

  /**
   * Clean up downloaded file segments
   *
   * @returns
   */
  async cleanUpDownloadedFiles() {
    if (!this.options.clean) return;
    await Promise.all(
      this.downloadedFiles.map(async (file) => {
        try {
          await fs.unlink(file);
        } catch (error) {}
      })
    );
    if (this.options.convert2Mp4) {
      let mergedFilePath = path.resolve(this.segmentsDir, "output.ts");
      if (await fs.pathExists(mergedFilePath)) {
        await fs.unlink(mergedFilePath);
      }
    }
  }
  //#endregion Private util methods

  //#region Private methods
  registerEventListeners() {
    this.on(M3U8DownloadTask.EventTypes.Progress, (task, progress) => {
      const progressFloat = parseFloat(progress.downloaded / progress.total);
      this.progress = progressFloat;
    });
    this.on(M3U8DownloadTask.EventTypes.Completed, (task) => {
      if (!this.options.interruptOnError) {
        this.progress = 1.0;
      }
    });
  }
  //#endregion Private methods
}
