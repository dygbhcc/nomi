#!/bin/bash
# Calls manualGeminiNlp endpoint in a loop until all restaurants are processed.
# Each call processes 100 restaurants via deployed Cloud Function (Vertex AI).

URL="https://manualgemininlp-kzlp5cszdq-ew.a.run.app"
SECRET="nomi-secret-2026"
BATCH_SIZE=40
MAX_ROUNDS=45

echo "=== Bulk NLP via Cloud Function ==="
echo "Batch size: $BATCH_SIZE | Max rounds: $MAX_ROUNDS"
echo ""

for i in $(seq 1 $MAX_ROUNDS); do
  echo "--- Round $i/$MAX_ROUNDS ($(date '+%H:%M:%S')) ---"

  RESPONSE=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "x-nomi-secret: $SECRET" \
    -d "{\"batchSize\": $BATCH_SIZE}" \
    --max-time 600)

  echo "Response: $RESPONSE"

  # Check if processed is 0 (no more restaurants)
  PROCESSED=$(echo "$RESPONSE" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*')

  if [ "$PROCESSED" = "0" ]; then
    echo ""
    echo "=== ALL DONE! No more restaurants to process. ==="
    exit 0
  fi

  echo "Processed: $PROCESSED | Waiting 10 seconds before next round..."
  echo ""
  sleep 10
done

echo "=== Reached max rounds ($MAX_ROUNDS). Run again if more remain. ==="
