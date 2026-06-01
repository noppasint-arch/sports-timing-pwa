#!/bin/bash
export PATH="$HOME/.local/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")"

# Start server
node server/index.cjs &
SERVER_PID=$!

sleep 2

# Start tunnel with fixed SSH key (URL stays the same every time)
ssh -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -i "$HOME/.ssh/sports_timing_tunnel" \
    -R 80:localhost:3001 \
    nokey@localhost.run

# If tunnel dies, kill server too
kill $SERVER_PID 2>/dev/null
