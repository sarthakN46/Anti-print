# Use Node.js base image
FROM node:18-slim

# Install Python3, Pip, and LibreOffice (for conversion)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libreoffice \
    default-jre \
    && rm -rf /var/lib/apt/lists/*

# Set Working Directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies (pypdf, etc.) - EXCLUDE comtypes/pywin32
# We filter out windows-only packages from requirements if present, 
# or just install specific ones.
# Safer to just install what we strictly need here to avoid errors.
RUN pip3 install pypdf python-docx python-pptx docx2pdf

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Copy scripts to dist (Explicitly)
RUN mkdir -p dist/scripts && cp -r src/scripts/* dist/scripts/ && chmod +x dist/scripts/*.py

# Expose Port
EXPOSE 5000

# Start Command
CMD ["npm", "start"]
