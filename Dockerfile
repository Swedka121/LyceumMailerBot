FROM oven/bun:1.3.14-alpine AS prod

WORKDIR /bot

COPY package.json bun.lockb* tsconfig.json ./
RUN bun install

COPY . .

CMD ["bun", "src/index.ts"]