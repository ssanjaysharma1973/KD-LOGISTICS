FROM node:20-slim

WORKDIR /app

# Install build tools needed for sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies using lock file for reproducibility
COPY package*.json ./
RUN npm ci

# Copy ALL source files (frontend src + backend server files)
COPY . .

# Frontend build - outputs to ./build
RUN npm run build

ENV PORT=5001
EXPOSE 5001

# Use full server with backend
CMD ["node", "server.js"]
