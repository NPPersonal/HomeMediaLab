import fs from "fs-extra";
import path from "node:path";
import { spawn } from "node:child_process";
import EventEmitter from "eventemitter3";
import axios from "axios";
import axiosRetry from "axios-retry";
import PQueue from "p-queue";
import * as m3u8Parser from "m3u8-parser";
import { combineURL, getBaseURL, isUrl } from "./utils.js";
import {
  DefaultOptions,
  DefaultProgress,
  DefaultReport,
  EventTypes,
  States,
} from "./types.js";
import { dateTimeLog } from "./utils.js";
import { isValidFileExtension } from "./utils.js";

export { DefaultOptions, DefaultProgress, DefaultReport, EventTypes, States };

const SUPPORT_OUTPUT_FILE_TYPES = [".mp4"];
export default class M3U8Downloader extends EventEmitter {
  /**
   * M3U8Downloader
   *
   * @param {string} m3u8Url url to m3u8 file
   * @param {string} output output path (e.g file/video/out.mp4)
   * @param {DefaultOptions} options options as object
   */
  constructor(m3u8Url, output, options = DefaultOptions) {
    super();
    this.options = Object.assign(DefaultOptions, options);
    this.m3u8Url = m3u8Url;
    this.output = output;
    this.segmentsDir = this.options.segmentsDir;
    this.queue = new PQueue({ concurrency: this.options.concurrency });
    this.totalSegments = 0;
    this.downloadedSegments = 0;
    this.downloadFailedSegments = 0;
    this.downloadedFiles = [];
    this.eventLogs = [];

    // Setup axio retry download
    axiosRetry(axios, {
      retries: this.options.retries,
      retryDelay: axiosRetry.exponentialDelay,
    });
    this.registerInternalListeners();
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
      const m3u8Content = await this.getM3U8(
        this.m3u8Url,
        this.options.headers
      );

      // Parsing m3u8 content
      const tsUrls = await this.parseM3U8(
        m3u8Content,
        this.options.m3u8PlaylistIndex
      );

      // Get portion/range of tsUrls we want to download
      const urls = tsUrls.slice(this.options.startIndex, this.options.endIndex);
      this.totalSegments = urls.length;

      // Download .ts files
      await this.downloadTsSegments(urls);

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
              this.emit(
                EventTypes.Error,
                new Error(
                  `Unable to convert to mp4, output ${this.output} is not a valid file types\nSupported file types are: ${SUPPORT_OUTPUT_FILE_TYPES}`
                )
              );
            }
          } else {
            fs.unlinkSync(tsMediaPath);
            this.emit(
              EventTypes.Error,
              new Error(
                `Unable to convert to mp4, output ${this.output} was not given`
              )
            );
          }
        }
      }

      if (!this.isRunning()) {
        await this.cleanUpDownloadedFiles();
        return;
      }
      this.emit("completed", this.generateReport());
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

      // change m3u8 url
      this.m3u8Url = getBaseURL(playlist.url);
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
          this.downloadFailedSegments++;
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
      const progress = Object.assign(DefaultProgress, {
        url: tsUrl,
        downloadedFile: segmentPath,
        downloaded: this.downloadedSegments,
        total: this.totalSegments,
      });
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
    const progress = Object.assign(DefaultProgress, {
      url: tsUrl,
      downloadedFile: segmentPath,
      downloaded: this.downloadedSegments,
      total: this.totalSegments,
    });
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

    this.emit(EventTypes.Merging);

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
    this.emit(EventTypes.Merged, mergedFilePath);
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
      this.emit(EventTypes.Converting, inputFilePath);

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

  /**
   * Generate a report
   * @returns a report object
   */
  generateReport() {
    return Object.assign(DefaultReport, {
      url: this.m3u8Url,
      output: this.output,
      totalSegments: this.totalSegments,
      downloadedSegments: this.downloadedSegments,
      downloadFailedSegments: this.downloadFailedSegments,
      downloadedFiles: this.downloadedFiles,
      eventLogs: this.eventLogs,
    });
  }

  /**
   * Listen to events and perform relative task
   */
  registerInternalListeners() {
    this.on(EventTypes.Start, () => {
      this.eventLogs.push(dateTimeLog("Download started"));
    });
    this.on(EventTypes.Pause, () => {
      this.eventLogs.push(dateTimeLog("Download paused"));
    });
    this.on(EventTypes.Resume, () => {
      this.eventLogs.push(dateTimeLog("Download resumed"));
    });
    this.on(EventTypes.Merging, () => {
      this.eventLogs.push(dateTimeLog("Merging segments"));
    });
    this.on(EventTypes.Merged, () => {
      this.eventLogs.push(dateTimeLog("Merge segements completed"));
    });
    this.on(EventTypes.Converting, (inputFilePath) => {
      this.eventLogs.push(dateTimeLog(`Converting file ${inputFilePath}`));
    });
    this.on(EventTypes.Converted, (outputFilePath) => {
      this.eventLogs.push(
        dateTimeLog(`Conversion completed at ${outputFilePath}`)
      );
    });
    this.on(EventTypes.Canceled, () => {
      this.status = States.Canceled;
      this.eventLogs.push(dateTimeLog("Download canceled"));
      this.cleanUpDownloadedFiles();
    });
    this.on(EventTypes.Error, async (error) => {
      console.error(error);
      this.status = States.Error;
      this.eventLogs.push(dateTimeLog(`Error: ${error.message}`));
    });
    this.on(EventTypes.Completed, () => {
      this.status = States.Completed;
      this.eventLogs.push(dateTimeLog("Download completed"));
    });
  }
  // #endregion private
}
