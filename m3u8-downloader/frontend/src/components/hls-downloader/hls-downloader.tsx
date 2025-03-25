import React from "react";
import HLSVideoPlayer from "./hls-video-player";
import { Button } from "../ui/button";

interface PropType {
  hlsUrls: string[] | undefined;
  onDownloadClick?: (url: string) => void;
}

const HLSDownloader = (props: PropType) => {
  const { hlsUrls, onDownloadClick } = props;

  if (hlsUrls && hlsUrls.length === 0) {
    return <div>{`Can't find any HLS video source`}</div>;
  }
  return (
    <div className="flex flex-col space-y-2">
      {hlsUrls?.map((url) => {
        return (
          <div key={url} className="flex flex-col items-center">
            <HLSVideoPlayer src={url} />
            <Button
              onClick={() => {
                if (onDownloadClick) onDownloadClick(url);
              }}
            >
              Download
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default HLSDownloader;
