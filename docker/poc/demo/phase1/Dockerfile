# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Install deps first for caching
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy repo
COPY . .

EXPOSE 3005

# Run Phase 1 supervisor (starts upstream + gateway)
CMD ["node", "poc/demo/phase1/run.js"]