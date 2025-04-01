import path from "path";

const FILE_STORAGE_PATH = "./storage";
export const getOutputFilePath = (file_path) => {
  return path.join(FILE_STORAGE_PATH, file_path);
};

const TEMP_DIR = "./tmp";
export const getTempDirectory = () => {
  return TEMP_DIR;
};
