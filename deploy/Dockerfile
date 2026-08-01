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

RUN apt-get update \
  && apt-get install --no-install-recommends --yes sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

EXPOSE 3000

CMD ["npm", "run", "start"]
