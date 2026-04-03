# Build on: 2026-04-04 00:45 UTC - Module scope fix  
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

ENV PORT=3000
ENV MASTER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
ENV MASTERS_API_URL=https://sandb-api.mastersindia.co
ENV MASTERS_USERNAME=Atul_logistics
ENV MASTERS_PASSWORD=Nitish@1997
ENV MASTERS_GSTIN=06EXQPK4096H1ZW
EXPOSE 3000

# Use full server with backend
CMD ["node", "server.js"]
