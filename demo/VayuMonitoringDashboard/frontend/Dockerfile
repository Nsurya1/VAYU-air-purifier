# ==============================================================================
# SOCHI VAYU - React Dashboard Multi-Stage Dockerfile
# Stage 1: Build static assets with Node 22 Alpine
# Stage 2: Serve with minimal Nginx Alpine
# ==============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ------------------------------------------------------------------------------
# Runtime Image: Nginx Alpine
# ------------------------------------------------------------------------------
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
