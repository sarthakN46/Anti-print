#!/bin/bash
# ==============================================================================
# XeroxSaaS Deployment Script for AWS EC2 (Ubuntu/Amazon Linux 2023)
# ==============================================================================
# Run this script ON your AWS EC2 instance.
# Usage: ./deploy-aws.sh

echo "🚀 Starting XeroxSaaS Backend Deployment on AWS EC2..."

# 1. System Updates & Prerequisites
echo "📦 Updating system packages..."
sudo yum update -y || sudo apt update -y

# 2. Install Git
if ! [ -x "$(command -v git)" ]; then
  echo "🔧 Installing Git..."
  sudo yum install git -y || sudo apt install git -y
fi

# 3. Install Docker
if ! [ -x "$(command -v docker)" ]; then
  echo "🐳 Installing Docker..."
  sudo amazon-linux-extras install docker -y || {
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
  }
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo usermod -aG docker $USER
  echo "⚠️  You may need to log out and log back in for Docker group changes to take effect."
fi

# 4. Install Docker Compose
if ! [ -x "$(command -v docker-compose)" ]; then
  echo "🐙 Installing Docker Compose..."
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

# 5. Clone Repository
REPO_DIR="$HOME/XeroxSaaS"
if [ ! -d "$REPO_DIR" ]; then
  echo "📂 Cloning repository..."
  git clone https://github.com/Toshalzambare/XeroxSaas.git "$REPO_DIR"
else
  echo "🔄 Updating existing repository..."
  cd "$REPO_DIR"
  git pull origin main
fi

cd "$REPO_DIR"

# 6. Check for .env file
if [ ! -f ".env" ]; then
  echo "❌ Error: .env file is missing!"
  echo "Please create the .env file in $REPO_DIR and populate it with your environment variables."
  echo "Run 'nano .env' to edit it, then run this script again."
  exit 1
fi

# 7. Start the Docker services
echo "🚀 Building and starting Docker containers..."
docker-compose up --build -d

echo "✅ Deployment successful! Your XeroxSaaS backend is now running."
echo "🔗 Ensure your EC2 Security Group allows inbound traffic on port 5000 (Backend API)."
