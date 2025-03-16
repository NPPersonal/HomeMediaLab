export const DefaultReport = {
  url: "",
  segmentsPlaylistUrl: "",
  output: "",
  totalSegments: 0,
  downloadedSegments: 0,
  downloadFailedSegments: 0,
  downloadedFiles: [],
  configs: {},
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
  /** Only use if given m3u8 file is a master file which contain other m3u8 files, default 0 */
  m3u8PlaylistIndex: 0,
};
