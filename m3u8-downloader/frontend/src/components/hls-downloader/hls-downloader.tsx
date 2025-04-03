"use client";

import React, { useEffect, useState } from "react";
import HLSVideoPlayer from "./hls-video-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CircleX } from "lucide-react";
import { isM3U8Url, isUrl } from "@/lib/utils";
import { downloadHLS, scrapeHLSFromWeb } from "@/actions/server-actions";
import { toast } from "sonner";
import HLSDownloadSetting from "./hls-download-setting";

const HLSDownloader = () => {
  const [webUrl, setWebUrl] = useState("");
  const [scrappingUrl, setScrappingUrl] = useState("");
  const [isScrapping, setIsScrapping] = useState(false);
  const [scrappingError, setScrappingError] = useState<Error | undefined>(
    undefined
  );

  const [foundHLSUrls, setFoundHLSUrls] = useState<string[] | undefined>(
    undefined
  );

  const downloadHLSVideo = async (url: string, output: string) => {
    try {
      await downloadHLS(url, output);
    } catch (error) {
      if (error instanceof Error)
        toast.error(
          <div className="text-red-500">
            <p className="font-bold">{`Error`}</p>
            <p>{error.message}</p>
          </div>
        );
      else
        toast.error(
          <div className="text-red-500">
            <p className="font-bold">{`Error`}</p>
            <p>{`Unable to download video`}</p>
          </div>
        );
    }
  };

  useEffect(() => {
    async function scrapeHLS(url: string) {
      if (!url) return;
      try {
        setIsScrapping(true);
        let data = undefined;
        if (isM3U8Url(url)) {
          data = [url];
        } else {
          const jsonData = await scrapeHLSFromWeb(url);
          data = jsonData.data;
        }
        // console.log(data);
        setIsScrapping(false);
        setScrappingError(undefined);
        setFoundHLSUrls(data);
        setWebUrl("");
      } catch (error) {
        setFoundHLSUrls(undefined);
        if (error instanceof Error) {
          setScrappingError(error);
        } else {
          setScrappingError(new Error(`Scrapping HLS fail ${url}`));
        }
        setFoundHLSUrls(undefined);
      } finally {
        setScrappingUrl("");
      }
    }

    if (scrappingUrl !== "") {
      if (isUrl(scrappingUrl)) {
        scrapeHLS(scrappingUrl);
      } else {
        setScrappingError(new Error(`HLS url not valid ${scrappingUrl}`));
      }
    }
  }, [scrappingUrl]);

  return (
    <React.Fragment>
      <div className="flex flex-col items-center space-y-2">
        <p>Scrape HLS URL from website or direct HLS URL</p>
        <div className="flex justify-center space-x-2">
          <Input
            value={webUrl}
            placeholder="Enter website url or HLS url"
            onChange={(value) => setWebUrl(value.target.value)}
          />
          <Button variant="outline" size="icon" onClick={() => setWebUrl("")}>
            <CircleX />
          </Button>
        </div>
        {scrappingError && (
          <p className="text-red-500 break-all">{scrappingError.message}</p>
        )}
        {foundHLSUrls && foundHLSUrls.length === 0 && (
          <p className="text-red-500 break-all">{`Can't find any HLS video source`}</p>
        )}
        <Button
          variant="outline"
          disabled={isScrapping}
          onClick={() => setScrappingUrl(webUrl)}
        >
          {isScrapping ? "Scrapping ..." : "Scrape HLS"}
        </Button>
      </div>
      <div className="flex flex-col space-y-2">
        {foundHLSUrls?.map((url) => {
          return (
            <div key={url} className="flex flex-col items-center">
              <HLSVideoPlayer src={url} />
              {/* <Button onClick={() => downloadHLSVideo(url)}>Download</Button> */}
              <HLSDownloadSetting
                url={url}
                onConfirm={(value) => {
                  downloadHLSVideo(value.url, value.filename);
                  console.log(value);
                }}
              />
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
};

export default HLSDownloader;
