# Stage 1: Build dependencies
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
# Clean install including devDependencies if needed for build/tests
RUN npm ci

COPY . .

# Stage 2: Production release
FROM node:20-alpine
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production

# Copy server and client assets from builder
COPY --from=builder /usr/src/app/server ./server
COPY --from=builder /usr/src/app/client ./client

# Create directories for persistent file logging
RUN mkdir -p logs && chown -R node:node logs

# Run as non-root user for enhanced security
USER node

EXPOSE 5000

CMD ["npm", "start"]
