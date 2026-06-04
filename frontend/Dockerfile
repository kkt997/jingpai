# ─── Build Stage ───
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/mobile/package.json packages/mobile/
COPY packages/merchant/package.json packages/merchant/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/

# Build apps directly
RUN pnpm --filter @jingpai/mobile build
RUN VITE_BASE=/merchant/ pnpm --filter @jingpai/merchant build

# ─── Runtime Stage ───
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/mobile/dist /usr/share/nginx/html/mobile
COPY --from=builder /app/packages/merchant/dist /usr/share/nginx/html/merchant

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
