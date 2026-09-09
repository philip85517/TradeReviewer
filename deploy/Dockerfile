FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run assets:ocr
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

ARG DEBIAN_MIRROR=mirrors.aliyun.com

RUN set -eu; \
  case "$DEBIAN_MIRROR" in \
    *[!A-Za-z0-9.-]*|"") echo "DEBIAN_MIRROR must be a hostname" >&2; exit 1 ;; \
  esac; \
  sed -i "s|http://deb.debian.org/debian-security|http://${DEBIAN_MIRROR}/debian-security|g; s|http://deb.debian.org/debian|http://${DEBIAN_MIRROR}/debian|g" /etc/apt/sources.list.d/debian.sources; \
  apt-get -o Acquire::Retries=5 update \
  && apt-get install --no-install-recommends --yes sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app
COPY --from=build /app/deploy/ops/sqlite-cli.mjs /usr/local/lib/tradereview-sqlite-cli.mjs
RUN printf '%s\n' '#!/bin/sh' 'exec env NODE_NO_WARNINGS=1 node /usr/local/lib/tradereview-sqlite-cli.mjs "$@"' > /usr/local/bin/sqlite3 \
  && chmod 0755 /usr/local/bin/sqlite3

EXPOSE 3000

CMD ["npm", "run", "start"]
