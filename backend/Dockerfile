FROM node:22-bullseye-slim

# Install build dependencies for better-sqlite3 and sharp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Create directories for data and images
RUN mkdir -p data workflows
# Images will be at /images at root of container, matched by volume

EXPOSE 3001

# Run in dev mode using ts-node-dev (as currently used in the project)
CMD ["npm", "run", "dev"]
