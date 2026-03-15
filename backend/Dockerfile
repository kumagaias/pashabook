# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install FFmpeg, vips, and complete HEIC support stack
# Using Debian packages for better HEIC support
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libvips-dev \
    libheif-dev \
    libde265-dev \
    libx265-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
