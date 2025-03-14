export const DefaultReport = {
  url: "",
  output: "",
  totalSegments: 0,
  downloadedSegments: 0,
  downloadFailedSegments: 0,
  downloadedFiles: [],
  eventLogs: [],
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

import os from "node:os";
export const DefaultOptions = {
  /** How many concurrent download to run */
  concurrency: 5,
  /** Whether to convert segments to mp4 file or not,
   * if true then mergeSegments must be true otherwise
   * it will not do conversion
   */
  convert2Mp4: false,
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
};

export const EventTypes = {
  /** Listener: () => void */
  Start: "start",
  /** Listener: (report) => void
   * 
   * @param {DefaultReport} report a report object
   * ```
   * {
    url: m3u8 url,
    output: conversion output file path,
    totalSegments: total .ts files need to be downloaded,
    downloadedSegments: downloaded .ts files,
    downloadFailedSegments: .ts files that fail to download,
    eventLogs: event logs,
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
  Merging: "merging",
  /** Listener: (mergedFilePath) => void
   *
   * Merge .ts files completed
   *
   * @param {*} mergedFilePath path to .ts merged file
   */
  Merged: "merged",
  /** Listener: (inputFilePath) => void
   *
   * Beginning converting .ts file
   * @param {*} inputFilePath path to .ts file that was merged
   * and will be used as input file for conversion
   */
  Converting: "converting",
  /**
   * Listener: (outputFilePath) => void
   *
   * @param {*} outputFilePath path to output file
   */
  Converted: "converted",
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

export const States = Object.assign(EventTypes, {
  Running: "running",
});
