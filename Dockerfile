FROM oven/bun:1 AS base

WORKDIR /app

# Build client
COPY client/package.json client/bun.lock* client/
RUN cd client && bun install

COPY client/ client/
RUN cd client && bun run build

# Install server deps
COPY server/package.json server/bun.lock* server/
RUN cd server && bun install

COPY server/ server/

# Expose port
EXPOSE ${PORT:-3001}

# Start server
CMD ["bun", "run", "server/src/index.ts"]
