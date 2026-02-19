#!/bin/bash

# Kill any existing processes on ports 5001 and 5173
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "🚀 Starting HealthHIVE..."

# Start Backend
echo "Starting Backend on port 5001..."
python3 -m backend.src.app &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start Frontend
echo "Starting Frontend..."
cd frontend
npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
