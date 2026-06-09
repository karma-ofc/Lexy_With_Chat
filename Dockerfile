FROM node:22.12.0-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

CMD ["node", "server/server.js"]