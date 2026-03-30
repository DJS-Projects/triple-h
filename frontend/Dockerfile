FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install dotenvx for encrypted .env decryption at runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && curl -sfS https://dotenvx.sh | sh \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# dotenvx decrypts .env using DOTENV_PRIVATE_KEY env var, then injects into process
CMD ["dotenvx", "run", "--", "bun", "server.js"]
