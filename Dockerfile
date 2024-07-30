FROM oven/bun:1 as base

WORKDIR /app

RUN mkdir /build

COPY package.json .

RUN bun i

COPY . .

# Run build
FROM base as builder

RUN bun run build

# Run repl
FROM base as runner

ENTRYPOINT [ "bun", "run", "src/exec/repl.ts" ]