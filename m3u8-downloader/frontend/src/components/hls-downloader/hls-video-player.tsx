import React, { useEffect, useRef } from "react";
import Hls from "hls.js";

interface PropType {
  src: string;
}
const HLSVideoPlayer = (props: PropType) => {
  const { src } = props;
  const videoRef = useRef(null);
  useEffect(() => {
    const hls = new Hls();
    if (Hls.isSupported()) {
      hls.loadSource(src);
      if (videoRef.current) hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.ERROR, (err) => {
        console.log(err);
      });
    } else {
      console.log("video load");
    }
  }, [src]);
  return (
    <div className="flex flex-col items-center m-4 space-x-1">
      <p className="break-all">{`Video source: ${src}`}</p>
      <p className="break-all">Preview</p>
      <video ref={videoRef} src={src} controls />
    </div>
  );
};

export default HLSVideoPlayer;
