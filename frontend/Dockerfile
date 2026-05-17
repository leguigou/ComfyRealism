# Stage 1: Build the React application
FROM node:20-bullseye-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine

# Copy the build output to Nginx's public directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 (standard for Nginx)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
