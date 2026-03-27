FROM node:20-slim

WORKDIR /app

# Install build tools needed for sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies using lock file for reproducibility
COPY package*.json ./
RUN npm ci

# Copy source and build frontend
COPY . .
RUN npm run build

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
