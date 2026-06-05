FROM oven/bun:latest AS base

FROM base AS builder
WORKDIR /bot
COPY ./src ./src
COPY package.json ./
COPY tsconfig.json ./
RUN bun install
RUN ls -l
RUN bun run build

FROM base AS prod
WORKDIR /bot
COPY --from=builder /bot/dist ./dist
COPY package.json ./
RUN bun install --only=production
CMD ["bun", "dist/index.js"]