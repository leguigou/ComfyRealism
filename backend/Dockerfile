# Stage 1: Build TypeScript
FROM node:22-bullseye-slim AS build

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx tsc

# Stage 2: Production runtime — no dev deps, no watcher
FROM node:22-bullseye-slim

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Install runtime deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Compiled JS goes to ./dist/ — __dirname resolves there
COPY --from=build /app/dist ./dist

# Workflows needed by both __dirname-based paths (comfy.ts, index.ts → dist/workflows/)
# and process.cwd()-based paths (misc.ts → ./workflows/)
COPY workflows ./dist/workflows
COPY workflows ./workflows

# Backup of default workflows for restore-on-empty-volume
RUN mkdir -p ./dist/data && cp -r ./dist/workflows ./dist/default_workflows

EXPOSE 3001

CMD ["node", "dist/index.js"]
