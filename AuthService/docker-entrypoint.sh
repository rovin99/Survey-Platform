#!/bin/bash
set -e

echo "Starting AuthService..."

# Run database migrations if efbundle exists
if [ -f "/app/efbundle" ]; then
    echo "Running database migrations..."
    # Retry migration up to 10 times (database might not be ready)
    max_retries=10
    retry_count=0
    until /app/efbundle --connection "$CONNECTION_STRING" 2>&1; do
        retry_count=$((retry_count + 1))
        if [ $retry_count -ge $max_retries ]; then
            echo "Warning: Migration failed after $max_retries attempts, continuing startup..."
            break
        fi
        echo "Migration attempt $retry_count failed, retrying in 3 seconds..."
        sleep 3
    done
    echo "Migration step completed."
else
    echo "No migration bundle found, skipping migrations."
fi

# Start the application
echo "Starting AuthService application..."
exec dotnet AuthService.dll
