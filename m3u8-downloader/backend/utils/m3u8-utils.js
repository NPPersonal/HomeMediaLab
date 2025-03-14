import { spawn } from "child_process";
import path from "node:path";
import fs from "fs";
import HLSDownloader from "hlsdownloader";
import { TS_LIST_FILENAME } from "./constant.js";

export const createDownloader = (
  downloadDir,
  url,
  concurrency = 10,
  onData = undefined,
  onError = undefined
) => {
  // onData // {url: "<url-just-downloaded>", totalItems: "<total-items-to-download>", path: "<absolute-path-of-download-loation>"}
  // onError // { url: "<URLofItem>", name: "<nameOfError>", message: "human readable message of error" }
  if (fs.existsSync(downloadDir)) {
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }

  const options = {
    playlistURL: url, // change it
    destination: downloadDir, // (optional: default '')
    concurrency: concurrency, // (optional: default = 1),
    overwrite: true, // (optional: default = false)
    // (optional: default = null)
    onData: onData,
    // (optional: default = null)
    onError: onError,
  };

  return new HLSDownloader(options);
};

export const generateTSMergeList = (dir) => {
  return new Promise((resolve, reject) => {
    // async finding list of .ts file path in the directory and subdirectory
    fs.readdir(dir, { recursive: true }, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      // turn them into string as format like:
      // file 'path/to/file1.ts'
      const fileList = files
        .filter((path) => path.endsWith(".ts"))
        .map((path) => `file '${path}'\n`);

      // create a .txt writable file stream
      // write file list into .txt file
      const filePath = path.join(dir, TS_LIST_FILENAME);
      const writeStream = fs.createWriteStream(filePath);

      fileList.forEach((value) => writeStream.write(value));

      writeStream.end();

      // listen on stream finish event
      writeStream.on("finish", () => {
        console.log(`wrote all the array data to file ${filePath}`);
      });

      // listen on stream error event
      writeStream.on("error", (err) => {
        console.error(`There is an error writing the file ${filePath}`, err);
        reject(err);
      });

      // listen on stream close event
      writeStream.on("close", () => {
        console.log("writable stream closed");
        resolve(filePath);
      });
    });
  });
};

export const convertTSToMP4 = (
  tsListFilePath,
  outputPath = "./output/videos/out.mp4"
) => {
  return new Promise((resolve, reject) => {
    // check if ts list file (.txt) exists
    if (!fs.existsSync(tsListFilePath)) {
      console.error(`can't find ${tsListFilePath} file`);
      reject(new Error(`can't find ${tsListFilePath} file`));
      return;
    }

    // create output directory if needed
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // create child process
    // use ffmpeg to convert ts files
    // to mp4
    const proc = spawn("ffmpeg", [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      tsListFilePath,
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-y",
      outputPath,
    ]);

    proc.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });

    proc.stderr.on("error", (err) => {
      console.error(`stderr: ${err}`);
      reject(err);
    });

    proc.on("error", (err) => {
      console.error(`process error: ${err}`);
      reject(err);
    });

    proc.on("close", (code) => {
      console.log(`child process exited with code ${code}`);
      resolve(code);
    });
  });
};

export const removeWorkingDir = (dir) => {
  return new Promise((resolve, reject) => {
    try {
      if (fs.existsSync(dir)) {
        fs.rm(dir, { recursive: true }, () => {
          console.log(`Directory ${dir} has been removed`);
          resolve();
        });
      }
    } catch (err) {
      reject(err);
    }
  });
};
