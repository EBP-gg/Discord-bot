# Use an ARM-compatible base image.
FROM node:20-trixie-slim

# Install the required dependencies for Puppeteer.
RUN apt-get update && apt-get install -y \
  chromium \
  ca-certificates \
  fonts-liberation \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Puppeteer config
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create an application directory.
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies (without dev dependencies)
RUN npm install --production

# Copy the rest of the application
COPY . .

# Create data directory for database persistence
RUN mkdir -p /app/data && chmod -R 777 /app/data

# Start the application.
CMD ["node", "src/index.js"]