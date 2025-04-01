import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const FILE_STORAGE_PATH = "./storage";
export const getOutputFilePath = (file_path) => {
  return path.join(FILE_STORAGE_PATH, file_path);
};

export const getStorageRootPath = () => {
  return FILE_STORAGE_PATH;
};

const TEMP_DIR = "./tmp";
export const getTempDirectory = () => {
  return TEMP_DIR;
};
