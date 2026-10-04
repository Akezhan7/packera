FROM node:24-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json .npmrc ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json server.js ./
COPY server ./server
COPY scripts ./scripts
COPY public ./public
RUN mkdir -p /app/public/products && chown node:node /app/public/products
USER node
EXPOSE 3001
CMD ["node", "server.js"]
