FROM node:24-slim

WORKDIR /app

# Copy server package files and install dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev --silent

# Copy server source
COPY server/ ./server/

# Copy pre-built client dist
COPY client/dist/ ./client/dist/

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "index.js"]
