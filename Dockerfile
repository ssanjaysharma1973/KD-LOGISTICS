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

# Verify backend source files are present
RUN ls -la src/ && ls -la src/middleware/ && ls -la src/services/

ENV NODE_OPTIONS=--no-warnings
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
