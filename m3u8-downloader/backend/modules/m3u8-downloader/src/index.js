import os from "node:os";
import fs from "fs-extra";
import path from "node:path";
import { spawn } from "node:child_process";
import EventEmitter from "eventemitter3";
import axios from "axios";
import axiosRetry from "axios-retry";
import PQueue from "p-queue";
import * as m3u8Parser from "m3u8-parser";
import { isUrl } from "./utils.js";

export const EventTypes = {
  /** Listener: () => void */
  Start: "start",
  /** Listener: () => void */
  Completed: "completed",
  /** Listener: () => void */
  Canceled: "canceled",
  /** Listener: () => void */
  Pause: "pause",
  /** Listener: () => void */
  Resume: "resume",
  /**
   * Listener: (outputFilePath) => void
   *
   * @param {*} outputFilePath path to output file
   */
  Converted: "converted",
  /**
   * Listener: (progress) => void
   * 
   * @param {*} progress an object
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
   * Listener: (error) => void
   *
   * @param {*} error Error
   */
  Error: "error",
};

const States = Object.assign(EventTypes, {
  Running: "running",
});

const defaultOptions = {
  /** How many concurrent download to run */
  concurrency: 5,
  /** Whether to convert segments to mp4 file or not,
   * if true then mergeSegments must be true otherwise
   * it will not do conversion
   */
  convert2Mp4: false,
  /** Whether to merge segements into single .ts file or not  */
  mergeSegments: true,
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
};

export default class M3U8Downloader extends EventEmitter {
  /**
   * M3U8Downloader
   *
   * @param {string} m3u8Url url to m3u8 file
   * @param {string} output output path (e.g file/video/out.mp4)
   * @param {defaultOptions} options options as object
   */
  constructor(m3u8Url, output, options = defaultOptions) {
    super();
    this.options = Object.assign(defaultOptions, options);
    this.m3u8Url = m3u8Url;
    this.output = output;
    this.segmentsDir = this.options.segmentsDir;
    this.queue = new PQueue({ concurrency: this.options.concurrency });
    this.totalSegments = 0;
    this.downloadedSegments = 0;
    this.downloadedFiles = [];

    // Setup axio retry download
    axiosRetry(axios, {
      retries: this.options.retries,
      retryDelay: axiosRetry.exponentialDelay,
    });

    /**
     * Listen to events and perform relative task
     */
    this.on(EventTypes.Canceled, () => {
      this.status = States.Canceled;
      this.cleanUpDownloadedFiles();
    });
    this.on(EventTypes.Error, async (error) => {
      console.error(error);
      this.status = States.Error;
      this.cleanUpDownloadedFiles();
    });
    this.on(EventTypes.Completed, () => {
      this.status = States.Completed;
    });
  }

  // #region public
  /** Beginning download process */
  async download() {
    try {
      this.emit(EventTypes.Start);
      this.status = States.Running;

      // Make directory for download segments if it doesn't exists
      if (!(await fs.pathExists(this.segmentsDir))) {
        await fs.mkdir(this.segmentsDir, { recursive: true });
      }

      // Make directory for output if it dosen't exists
      const outputDir = path.dirname(this.output);
      if (!(await fs.pathExists(outputDir))) {
        await fs.mkdir(outputDir, { recursive: true });
      }

      // Fetch m3u8 file from url
      const m3u8Content = await this.getM3U8(
        this.m3u8Url,
        this.options.headers
      );

      // Parsing m3u8 content
      const tsUrls = this.parseM3U8(m3u8Content);

      // Get portion/range of tsUrls we want to download
      const urls = tsUrls.slice(this.options.startIndex, this.options.endIndex);
      this.totalSegments = urls.length;

      // Download .ts files
      await this.downloadTsSegments(urls);

      // If downloaded .ts files need to be merged
      if (this.options.mergeSegments) {
        const tsMediaPath = await this.mergeTsSegments(this.totalSegments);

        // If merged .ts file need to be convert to mp4
        if (this.options.convert2Mp4) {
          await this.convertToMp4(tsMediaPath);
        }
      }

      if (!this.isRunning()) {
        await this.cleanUpDownloadedFiles();
        return;
      }
      this.emit("completed");
    } catch (error) {
      this.emit(EventTypes.Error, error);
    }
  }
  /**
   * Pause download
   */
  pause() {
    if (!this.isRunning()) return;

    // running in queue will not be paused
    this.status = States.Pause;
    this.emit(EventTypes.Pause);
    this.queue.pause();
  }

  /**
   * Resume download
   */
  resume() {
    if (this.status !== States.Pause) return;
    this.status = States.Running;
    this.emit(EventTypes.Resume);
    this.queue.start();
  }

  /**
   * Cancel download
   */
  cancel() {
    if ([States.Completed, States.Canceled, States.Error].includes(this.status))
      return;

    this.status = States.Canceled;
    this.emit(EventTypes.Canceled);
    this.queue.clear();
  }
  // #endregion public

  // #region private
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
   * Get .ts urls from m3u8 content
   *
   * @param {string} m3u8Content
   * @returns array of string as url
   */
  parseM3U8(m3u8Content) {
    const parser = new m3u8Parser.Parser();

    parser.push(m3u8Content);
    parser.end();

    const parsedManifest = parser.manifest;
    return (parsedManifest?.segments || []).map((segment) => {
      if (isUrl(segment.uri)) {
        return segment.uri;
      } else {
        return new URL(segment.uri, this.m3u8Url).href;
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
        .add(() => this.downloadSegment(tsUrl, index))
        .catch((error) => {
          this.emit(
            EventTypes.Error,
            new Error(
              `Failed to download segment ${index}\nurl: ${tsUrl} \nreason: ${error}\n`
            )
          );
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
    if (!this.isRunning()) return;

    const formattedIndex = String(index).padStart(5, "0");

    // Create segment path
    const segmentPath = path.resolve(
      this.segmentsDir,
      `segment${formattedIndex}.ts`
    );

    // If segment file exists and don't override it
    if (this.options.skipExistSegments && (await fs.pathExists(segmentPath))) {
      this.downloadedSegments++;
      const progress = {
        url: tsUrl,
        downloadedFile: segmentPath,
        downloaded: this.downloadedSegments,
        total: this.totalSegments,
      };
      this.emit(EventTypes.Progress, progress);
      return progress;
    }

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
    const progress = {
      url: tsUrl,
      downloadedFile: segmentPath,
      downloaded: this.downloadedSegments,
      total: this.totalSegments,
    };
    this.emit(EventTypes.Progress, progress);

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
    if (!this.isRunning()) return;
    let mergedFilePath = path.resolve(this.segmentsDir, "output.ts");

    if (!this.options.convert2Mp4) {
      mergedFilePath = this.output;
    }

    // Create a writable file stream
    const writeStream = fs.createWriteStream(mergedFilePath);

    for (let index = 0; index < total; index++) {
      if (!this.isRunning()) {
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
        this.emit(
          EventTypes.Error,
          new Error(
            `Segment ${index} is missing\nExpected file at path: ${segmentPath}\n${error}\n`
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
   * @param {*} mergedTSMediaPath path ot .ts merged file
   * @returns
   */
  async convertToMp4(mergedTSMediaPath) {
    if (!this.isRunning()) return;

    const inputFilePath = mergedTSMediaPath;
    const outputFilePath = this.output;

    return new Promise((resolve, reject) => {
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
        this.emit("error", `Failed to convert to MP4: ${error.message}`);
        reject(error);
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          this.emit("error", `FFmpeg process exited with code ${code}`);
          reject(new Error(`FFmpeg process exited with code ${code}`));
          return;
        }
        fs.unlinkSync(inputFilePath); // remove merged TS file
        resolve(outputFilePath);
        this.emit(EventTypes.Converted, outputFilePath);
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

  /**
   * Whether download instance is in
   * running state
   * @returns
   */
  isRunning() {
    // return true when encoutner error while downloading
    // otherwise return false
    if (!this.options.interruptOnError) {
      return this.status === States.Running || this.status === States.Error;
    } else {
      return this.status === States.Running;
    }
  }
  // #endregion private
}
