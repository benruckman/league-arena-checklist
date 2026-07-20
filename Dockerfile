FROM node:22-bookworm-slim

WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --cache /tmp/npm-cache

COPY apps ./apps
COPY packages ./packages

RUN npm run build --workspace=@league-arena/web

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@league-arena/api"]
