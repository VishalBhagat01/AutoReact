FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Ensure storage directory exists
RUN mkdir -p storage/assets

EXPOSE 5000

ENV PORT=5000 \
    NODE_ENV=production

CMD ["node", "index.js"]
