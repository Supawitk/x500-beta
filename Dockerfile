FROM oven/bun:1

# Install R and required system libraries
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    r-base \
    r-base-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install R packages
RUN R -e "install.packages(c('jsonlite', 'forecast', 'quadprog', 'Matrix', 'MASS', 'proxy', 'zoo'), repos='https://cloud.r-project.org/', Ncpus=4)"

USER bun
WORKDIR /app

# Build client
COPY --chown=bun:bun client/package.json client/bun.lock* client/
RUN cd client && bun install

COPY --chown=bun:bun client/ client/
RUN cd client && bun run build

# Install server deps
COPY --chown=bun:bun server/package.json server/bun.lock* server/
RUN cd server && bun install

COPY --chown=bun:bun server/ server/

# Expose port
EXPOSE ${PORT:-3001}

# Start server
CMD ["bun", "run", "server/src/index.ts"]
