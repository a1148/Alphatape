FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/providers/package.json packages/providers/package.json
RUN npm ci
COPY . .
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
RUN chmod +x scripts/api-entrypoint.sh

FROM base AS api
ENV NODE_ENV=production
EXPOSE 3848
CMD ["sh", "scripts/api-entrypoint.sh"]

FROM base AS worker
ENV NODE_ENV=production
CMD ["npx", "tsx", "apps/worker/src/index.ts"]

FROM base AS web
ARG NEXT_PUBLIC_API_URL=http://localhost:3848
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3848/ws
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @alphatape/web
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@alphatape/web"]
