# syntax=docker/dockerfile:1
#
# One image that holds both the API and the built website.
#   stage 1: build the React site            (needs dev tools, thrown away afterwards)
#   stage 2: install server packages         (production packages only)
#   stage 3: the small image that actually runs

FROM node:22-alpine AS site
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS packages
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-alpine AS run
ENV NODE_ENV=production \
    PORT=5000 \
    UPLOAD_DIR=/data/uploads \
    CLIENT_DIST=/app/client/dist
WORKDIR /app/server
COPY --from=packages /build/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY --from=site /build/client/dist /app/client/dist
# Photos, audio and PDFs live here. Mount a volume on it so they survive updates.
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "src/index.js"]
