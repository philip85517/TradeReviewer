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

COPY --from=build /app /app
COPY --from=build /app/deploy/ops/sqlite-cli.mjs /usr/local/lib/tradereview-sqlite-cli.mjs
RUN printf '%s\n' '#!/bin/sh' 'exec env NODE_NO_WARNINGS=1 node /usr/local/lib/tradereview-sqlite-cli.mjs "$@"' > /usr/local/bin/sqlite3 \
  && chmod 0755 /usr/local/bin/sqlite3

EXPOSE 3000

CMD ["npm", "run", "start"]
