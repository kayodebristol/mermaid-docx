# Use a Node.js devcontainer base on Debian (good Chromium apt support)
ARG VARIANT=22-bullseye
FROM mcr.microsoft.com/devcontainers/javascript-node:1-${VARIANT}

# Install Pandoc, Chromium, and headless Chrome dependencies + fonts
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      pandoc \
      chromium \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
      libgbm1 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      xdg-utils \
      ca-certificates \
      fonts-noto \
      fonts-noto-color-emoji \
      fonts-liberation \
      git \
      curl \
      unzip && \
    rm -rf /var/lib/apt/lists/*

# Helpful: show which Chromium is available (non-fatal)
RUN (which chromium || which chromium-browser || true) && node --version && npm --version && pandoc --version