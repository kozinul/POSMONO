FROM mcr.microsoft.com/devcontainers/typescript-node:20

RUN npm install -g pnpm@9.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    inetutils-ping \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

RUN echo 'export PNPM_HOME="/home/node/.local/share/pnpm"' >> /home/node/.zshrc \
    && echo 'export PATH="$PNPM_HOME:$PATH"' >> /home/node/.zshrc

USER node
