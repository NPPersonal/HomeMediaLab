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

m3u8 backend downloader is base on https://github.com/renmu123/m3u8-downloader and then improve on it.

Features:

> - Concurrent downloading of M3U8 video segments
> - Automatic retry on download failure
> - Support for stop, resume, cancel function
> - Merging TS segments into a single file
> - Optional conversion of TS files to MP4 format

New features:

> - Add more events
> - Choose either to intrrupt downloader or continue download while encountering an error
> - Don't convert TS files to MP4 format if output file path is not valid, this include file extension check
> - Report detail after downloader completed

Implementatoin change:

> - ES6 javascript instead of typescript(original implementation)
> - Using [eventemitter3](https://www.npmjs.com/package/eventemitter3) for events emitting and handling
