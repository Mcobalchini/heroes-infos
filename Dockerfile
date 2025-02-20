FROM node:18.17.0-alpine

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install dependencies and Chrome in a single RUN command
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

WORKDIR /usr/src/bot

COPY package.json package-lock.json ./
RUN npm install --production && npm cache clean --force

COPY . .

RUN chmod +x /usr/src/bot/init.sh

ENTRYPOINT ["/bin/sh", "/usr/src/bot/init.sh"]

CMD ["node", "app.js"]