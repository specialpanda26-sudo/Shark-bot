# Henry Tech V5.0 - Dockerfile
FROM node:20-slim

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Install Node.js dependencies
RUN npm install

# Install Python dependencies
RUN pip3 install --break-system-packages quart groq aiosqlite httpx

# Expose port
EXPOSE 5000

# Start both Python and Node together
CMD python3 app.py & node client_bridge.js
