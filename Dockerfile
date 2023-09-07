# ---- Base Node ----
FROM node:18-alpine AS base
# Set working directory
WORKDIR /app
# Copy package.json and package-lock.json
COPY package*.json ./

# ---- Dependencies ----
FROM base AS dependencies
# Install production dependencies
RUN npm ci --only=production

# ---- Build ----
FROM base AS build
# Install dev dependencies and build
COPY . .
RUN npm install && npm run build

# ---- Release ----
FROM base AS release
# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules
# Copy compiled app
COPY --from=build /app/dist ./dist

# Using a non-root user
USER node

CMD ["node", "dist/index.js"]
