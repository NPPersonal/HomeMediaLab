/**
 * Middleware that check if request's body contain task id or not
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @returns
 */
export const checkTaskId = (req, res, next) => {
  const { taskId } = req.body;
  if (!taskId) {
    res
      .status(400)
      .send(JSON.stringify({ message: "taskId is missing in request's body" }));
    return;
  }
  // console.log("middleware");
  next();
};

/**
 * Middleware that check if download hls route's request contain correct
 * parameters in body
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
export const checkDownloadHLSRequest = (req, res, next) => {
  const { url, output } = req.body;
  if (!url) {
    res
      .status(400)
      .send(JSON.stringify({ message: "url is missing in request's body" }));
  }
  if (!output) {
    res
      .status(400)
      .send(JSON.stringify({ message: "output is missing in request's body" }));
  }
  next();
};
