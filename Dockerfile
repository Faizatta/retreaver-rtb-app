# Lightweight Node.js LTS container
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY src/ ./src/

# Expose port (Render/Railway sets PORT dynamically)
ENV PORT=3000
EXPOSE 3000

# Start server
CMD ["node", "src/server.js"]
