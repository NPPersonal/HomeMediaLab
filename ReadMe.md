References:

- https://www.simplehomelab.com/docker-media-server-2024/
- https://github.com/renmu123/m3u8-downloader

# Deployment

At root directory add `.env` file and add following:

```
TUNNEL_TOKEN={your cloudflare tunnel token}
TZ={Time zone identifier refer to https://en.wikipedia.org/wiki/List_of_tz_database_time_zones}

```

At root run `docker compose up -d` to start services

# Services

- [socket-proxy](https://github.com/Tecnativa/docker-socket-proxy): docker socket security enhancement
  for container such as dozzle, portainer which required to access to docker api through docker socket.
- [gethomepage](https://gethomepage.dev/): dashboard for services
- [dozzle](https://dozzle.dev/): docker container monitoring and logging
- [portainer](https://www.portainer.io/): docker container management

# Reverse proxy

Use cloudflare's zero trust tunnel instead of reverse proxy such as [traefik](https://doc.traefik.io/traefik/).
Using other reverse proxy then don't use cloudflare's zero trust tunnel.

# homepage configs

Specific to container [gethomepage](https://gethomepage.dev/)

yaml file under path `composes/preset-configs/home-page` are preset config files for homepage container. Modify and then copy to `composes/storage/homepage_data/config` where the container volume mapping to after you start the container. Otherwise you have to modify yaml files in `composes/storage/homepage_data/config` the directory. See [refernces about configuration](https://gethomepage.dev/configs/).

# m3u8 downloader

This is planned to have backend server and frontend web.

## Backend

Server side have a module `m3u8-downloader` which is written in ES6 javascript and it is improved on https://github.com/renmu123/m3u8-downloader. Source code is located under `project_directory/m3u8-downloader/modules/m3u8-downloader`. The module is used for download .m3u8 file and its streaming video segments. In addition the module is able to merge streaming video segments into mp4 file with ffmpeg. Therefore the environment required to install ffmpeg first.

### Features:

> - Concurrent downloading of M3U8 video segments
> - Automatic retry on download failure
> - Support for stop, resume, cancel function
> - Merging TS segments into a single file
> - Optional conversion of TS files to MP4 format

### New features:

> - Add more events
> - Choose either to intrrupt downloader or continue download while encountering an error
> - Don't convert TS files to MP4 format if output file path is not valid, this include file extension check
> - Report detail after downloader completed
> - Able to differentiate master m3u8 file or m3u8 playlist, where master m3u8 file contain 1 to many urls reference to
>   other m3u8 playlist file
> - Add M3U8 download task to wrap around m3u8 downloader
> - Add Download manager managing multiple m3u8 download tasks
> - Store task's checkpoint to disk as json file and recover tasks from checkpoint
> - Add frontend web page for managing download tasks
> - Frontend provide tool for grabbing HLS video from website and download HLS video

### M3U8Downloader implementatoin change:

> - ES6 javascript instead of typescript(original implementation)
> - Using [eventemitter3](https://www.npmjs.com/package/eventemitter3) for events emitting and handling
> - More events

### Usage

ES6 javascript

```
import M3U8Downloader, {EventTypes,} from "./modules/m3u8-downloader/src/index.js";

const downloader = new M3U8Downloader("to/m3u8/file/url", "output/out.mp4", {
    mergeSegments: true,
    convert2Mp4: true,
    clean: true,
    segmentsDir: "path/to/segments/download/directory"
  });

  // listen event on download progress
  downloader.on(EventTypes.Progress, (progress) => {
    console.log(
      `Download progress: ${progress.downloaded}/${progress.total} ${progress.url}`
    );
  });

  // listen event on download completed
  downloader.on(EventTypes.Completed, (report) => {
    console.log("Download completed", report);
  });

  // listen event when download error
  downloader.on(EventTypes.Error, (error) => {
    console.error("Error occurred:", error);
  });

  // start download task
  downloader.download();
```
