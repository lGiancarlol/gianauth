#!/bin/bash
# deploy.sh — GianAuth frontend production build for Ubuntu VPS
set -e

echo "==> Installing dependencies (including devDependencies for build)..."
npm install

echo "==> Building Next.js..."
npm run build

echo "==> Done. Start with: npm start"
