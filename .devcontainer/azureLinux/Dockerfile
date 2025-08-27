# Azure Linux (CBL‑Mariner) base
FROM mcr.microsoft.com/azurelinux/base/core:3.0

# Install essentials with tdnf (Azure Linux package manager)
RUN tdnf -y update && \
    tdnf -y install \
      ca-certificates \
      curl tar gzip xz \
      git gawk\
      nodejs nodejs-npm \
      fontconfig  \
      dejavu-sans-fonts dejavu-sans-mono-fonts dejavu-serif-fonts && \
    tdnf clean all

# Install pandoc (generic Linux tarball)
ARG PANDOC_VER=3.1.11.1
RUN curl -fsSL -o /tmp/pandoc.tgz https://github.com/jgm/pandoc/releases/download/${PANDOC_VER}/pandoc-${PANDOC_VER}-linux-amd64.tar.gz \
 && tar -xzf /tmp/pandoc.tgz -C /usr/local --strip-components=1 \
 && rm /tmp/pandoc.tgz

# Optional: try system Chromium (may not be available in all mirrors)
# If not present, Puppeteer will download its own Chromium during npm install.
RUN tdnf -y install chromium || true

# Show versions (non-fatal if chromium missing)
RUN node --version && npm --version && pandoc --version && (which chromium || true)