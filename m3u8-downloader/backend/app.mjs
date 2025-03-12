import express from "express";
const app = express();
const port = 3000;

import {
  createDownloader,
  generateTSMergeList,
  convertTSToMP4,
  removeWorkingDir,
} from "./utils/m3u8-utils.mjs";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";
import { TEMP_DIR } from "./utils/constant.mjs";

const tasks = [];

app.get("/download", (req, res) => {
  const id = uuidv4();
  const workingPath = path.join(TEMP_DIR, id);
  const downloader = createDownloader(
    workingPath,
    "https://vip.lz-cdn6.com/20220817/22481_342a8e06/index.m3u8",
    10,
    (data) => {
      console.log(data.path);
    },
    (error) => {
      console.error(error);
    }
  );

  tasks.push(downloader);

  downloader.startDownload().then(async (response) => {
    console.log("download successful", response);
    try {
      const tsFilePath = await generateTSMergeList(workingPath);
      await convertTSToMP4(tsFilePath);
      await removeWorkingDir(workingPath);
    } catch (err) {
      console.error(err);
    }
  });
  res.send(`dwonload m3u8 video from ${req.query.url}`);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
