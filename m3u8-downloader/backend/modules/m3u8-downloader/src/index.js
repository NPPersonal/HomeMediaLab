import fs from "fs-extra";
import path from "node:path";
import { spawn } from "node:child_process";
import EventEmitter from "eventemitter3";
import axios from "axios";
import axiosRetry from "axios-retry";
import PQueue from "p-queue";
import * as m3u8Parser from "m3u8-parser";
import { combineURL, getBaseURL, isUrl } from "./utils.js";
import { DefaultOptions, DefaultProgress, DefaultReport } from "./types.js";
import { dateTimeLog } from "./utils.js";
import { isValidFileExtension } from "./utils.js";

export { DefaultOptions, DefaultProgress, DefaultReport };

const SUPPORT_OUTPUT_FILE_TYPES = [".mp4"];

/**
 * M3U8Downloader implementation is base on https://github.com/renmu123/m3u8-downloader
 * and improve on it.
 *
 * This class responsible for:
 * - Downloading video segments from .m3u8 files
 * - Merging video segments into single video file
 * - Converting video to `.mp4` vide file
 * - Manage downloader's state
 * - Emitting events
 *
 * Usage:
 * Create a `M3U8Downloader` instance and provide it with requried arguments
 *
 *
 */
export default class M3U8Downloader extends EventEmitter {
  //#region Class event types
  static EventTypes = {
    StatusChanged: "status_changed",
    /** Listener: () => void */
    Start: "start",
    /** Listener: (report) => void
     * 
     * @param {DefaultReport} report a report object
     * ```
     * {
      url: m3u8 url (could be the master m3u8 file),
      segmentsPlaylistUrl: .m3u8 url to playlist for fetching segments, 
      output: conversion output file path,
      totalSegments: total number of .ts files suppose to be downloaded,
      downloadedSegments: total number of downloaded .ts files,
      downloadFailedSegments: total number of .ts files that fail to download,
      downloadedFiles: downloaded files location path in array,
      configs: configuration for downloader,
      eventLogs: event logs array in string,
      }
     * ```
     */
    Completed: "completed",
    /** Listener: () => void */
    Canceled: "canceled",
    /** Listener: () => void */
    Pause: "pause",
    /** Listener: () => void */
    Resume: "resume",
    /** Listener: () => void
     * Beginning merging .ts files
     */
    BeginMerge: "begin_merge",
    /**
     * Listener: (filePath) => void
     * When a segment has been merged
     */
    SegmentMerged: "segment_merged",
    /** Listener: (mergedFilePath) => void
     *
     * Merge .ts files completed
     *
     * @param {*} mergedFilePath path to .ts merged file
     */
    MergeCompleted: "merge_completed",
    /** Listener: (inputFilePath) => void
     *
     * Beginning converting .ts file
     * @param {*} inputFilePath path to .ts file that was merged
     * and will be used as input file for conversion
     */
    BeginConversion: "begin_conversion",
    /**
     * Listener: (outputFilePath) => void
     *
     * @param {*} outputFilePath path to output file
     */
    ConversionCompleted: "conversion_completed",
    /**
       * Listener: (progress) => void
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
     * Listener: (error) => void
     *
     * @param {*} error Error
     */
    Error: "error",
  };
  //#endregion Class event types

  //#region Class states
  static States = Object.assign(this.EventTypes, {
    Unknown: "unknown",
    Running: "running",
  });
  //#endregion Class states

  //#region  Getter
  get status() {
    return this._status;
  }
  //#endregion Getter

  //#region Setter
  set status(newStatus) {
    const oldStatus = this._status;
    this._status = newStatus;
    this.emit(M3U8Downloader.EventTypes.StatusChanged, oldStatus, this._status);
  }
  //#endregion Setter

  //#region Constructor
  /**
   * M3U8Downloader
   *
   * @param {string} m3u8Url url to m3u8 file
   * @param {string} output output path (e.g file/video/out.mp4)
   * @param {DefaultOptions} options options as object
   */
  constructor(m3u8Url, output, options = DefaultOptions, status = undefined) {
    super();
    this.status = status ? status : M3U8Downloader.States.Unknown;
    this.options = Object.assign(DefaultOptions, options);
    this.m3u8Url = m3u8Url;
    // The playlistUrl is used to fetch playlist's segments,
    // default to m3u8Url but need to be changed when m3u8Url to m3u8 file
    // contain other playlists
    this.playlistUrl = this.m3u8Url;
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
  //#endregion Constructor

  // #region public
  /** Beginning download process */
  async download() {
    try {
      this.emit(M3U8Downloader.EventTypes.Start);
      this.status = M3U8Downloader.States.Running;

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
                M3U8Downloader.EventTypes.Error,
                new Error(
                  `Unable to convert to mp4, output ${this.output} is not a valid file types\nSupported file types are: ${SUPPORT_OUTPUT_FILE_TYPES}`
                )
              );
            }
          } else {
            fs.unlinkSync(tsMediaPath);
            this.emit(
              M3U8Downloader.EventTypes.Error,
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
      this.emit(M3U8Downloader.EventTypes.Completed, this.generateReport());
    } catch (error) {
      this.emit(M3U8Downloader.EventTypes.Error, error);
    }
  }
  /**
   * Pause download
   */
  pause() {
    if (!this.isRunning()) return;

    // running in queue will not be paused
    this.status = M3U8Downloader.States.Pause;
    this.emit(M3U8Downloader.EventTypes.Pause);
    this.queue.pause();
  }

  /**
   * Resume download
   */
  resume() {
    if (this.status !== M3U8Downloader.States.Pause) return;
    this.status = M3U8Downloader.States.Running;
    this.emit(M3U8Downloader.EventTypes.Resume);
    if (this.queue.size === 0) {
      this.download();
      return;
    }
    this.queue.start();
  }

  /**
   * Cancel download
   */
  cancel() {
    if (
      [
        M3U8Downloader.States.Completed,
        M3U8Downloader.States.Canceled,
        M3U8Downloader.States.Error,
      ].includes(this.status)
    )
      return;

    this.status = M3U8Downloader.States.Canceled;
    this.emit(M3U8Downloader.EventTypes.Canceled);
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
        .add(() => this.downloadSegment(tsUrl, index))
        .catch((error) => {
          this.downloadFailedSegments++;
          this.emit(
            M3U8Downloader.EventTypes.Error,
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
      this.emit(M3U8Downloader.EventTypes.Progress, progress);
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
    this.emit(M3U8Downloader.EventTypes.Progress, progress);

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

    this.emit(M3U8Downloader.EventTypes.BeginMerge);

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

        this.emit(M3U8Downloader.EventTypes.SegmentMerged, segmentPath);

        // Whether to delete .ts source file after merged or not
        if (deleteSource) await fs.unlink(segmentPath); // 删除临时 TS 片段文件
      } catch (error) {
        this.emit(
          M3U8Downloader.EventTypes.Error,
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
    this.emit(M3U8Downloader.EventTypes.MergeCompleted, mergedFilePath);
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
      this.emit(M3U8Downloader.EventTypes.BeginConversion, inputFilePath);

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
        this.emit(
          M3U8Downloader.EventTypes.Error,
          `Failed to convert to MP4: ${error.message}`
        );
        reject(error);
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          this.emit(
            M3U8Downloader.EventTypes.Error,
            `FFmpeg process exited with code ${code}`
          );
          reject(new Error(`FFmpeg process exited with code ${code}`));
          return;
        }
        fs.unlinkSync(inputFilePath); // remove merged TS file
        resolve(outputFilePath);
        this.emit(
          M3U8Downloader.EventTypes.ConversionCompleted,
          outputFilePath
        );
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
      return (
        this.status === M3U8Downloader.States.Running ||
        this.status === M3U8Downloader.States.Error
      );
    } else {
      return this.status === M3U8Downloader.States.Running;
    }
  }

  /**
   * Generate a report
   * @returns a report object
   */
  generateReport() {
    return Object.assign(DefaultReport, {
      url: this.m3u8Url,
      segmentsPlaylistUrl: this.playlistUrl,
      output: this.output,
      totalSegments: this.totalSegments,
      downloadedSegments: this.downloadedSegments,
      downloadFailedSegments: this.downloadFailedSegments,
      downloadedFiles: this.downloadedFiles,
      configs: this.options,
      eventLogs: this.eventLogs,
    });
  }

  /**
   * Listen to events and perform relative task
   */
  registerInternalListeners() {
    this.on(M3U8Downloader.EventTypes.Start, () => {
      this.eventLogs.push(dateTimeLog("Download started"));
    });
    this.on(M3U8Downloader.EventTypes.Pause, () => {
      this.eventLogs.push(dateTimeLog("Download paused"));
    });
    this.on(M3U8Downloader.EventTypes.Resume, () => {
      this.eventLogs.push(dateTimeLog("Download resumed"));
    });
    this.on(M3U8Downloader.EventTypes.BeginMerge, () => {
      this.eventLogs.push(dateTimeLog("Begin merging segments"));
    });
    this.on(M3U8Downloader.EventTypes.MergeCompleted, () => {
      this.eventLogs.push(dateTimeLog("Merge segements completed"));
    });
    this.on(M3U8Downloader.EventTypes.BeginConversion, (inputFilePath) => {
      this.eventLogs.push(
        dateTimeLog(`Begin converting video file ${inputFilePath}`)
      );
    });
    this.on(M3U8Downloader.EventTypes.ConversionCompleted, (outputFilePath) => {
      this.eventLogs.push(
        dateTimeLog(`Converting video file completed at ${outputFilePath}`)
      );
    });
    this.on(M3U8Downloader.EventTypes.Canceled, () => {
      this.status = M3U8Downloader.States.Canceled;
      this.eventLogs.push(dateTimeLog("Download canceled"));
      this.cleanUpDownloadedFiles();
    });
    this.on(M3U8Downloader.EventTypes.Error, async (error) => {
      console.error(error);
      this.status = M3U8Downloader.States.Error;
      this.eventLogs.push(dateTimeLog(`Error: ${error.message}`));
    });
    this.on(M3U8Downloader.EventTypes.Completed, () => {
      this.status = M3U8Downloader.States.Completed;
      this.eventLogs.push(dateTimeLog("Download completed"));
    });
  }
  // #endregion private
}
