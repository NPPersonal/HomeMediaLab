https://www.simplehomelab.com/docker-media-server-2024/
https://github.com/renmu123/m3u8-downloader

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
