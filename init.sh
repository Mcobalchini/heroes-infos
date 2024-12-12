#!/bin/bash
set -e  # Exit immediately if any command exits with a non-zero status
if [ -z "$CLIENT_ID" ]; then
  echo "Error: CLIENT_ID environment variable is not set!"
  exit 1
fi
# Create the folder inside the 'variable' directory
mkdir -p /usr/src/bot/data/variable/$CLIENT_ID
echo "Folder created: /usr/src/bot/data/variable/$CLIENT_ID"
# Run the main application
node app.js 