#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Installing Node Dependencies..."
npm install --production=false

echo "Installing Python Dependencies..."
pip3 install -r requirements.txt

echo "Building Project..."
npm run build

echo "Copying Python Scripts..."
cp -r src/scripts dist/scripts
