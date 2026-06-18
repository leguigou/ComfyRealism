FROM node:22-bullseye-slim

# Install build dependencies for better-sqlite3 and sharp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the code
COPY . .

# Create directories for data and images, and backup default workflows
RUN mkdir -p data workflows && cp -r workflows default_workflows
# Images will be at /images at root of container, matched by volume

RUN npm run build && npm prune --omit=dev

EXPOSE 3001

CMD ["npm", "run", "start"]
