#!/bin/bash
# Run NLP pipeline in batches of 50 until all restaurants are processed

URL="https://manualgemininlp-kzlp5cszdq-ew.a.run.app"
SECRET="nomi-secret-2026"
BATCH=1

while true; do
  echo "=== Batch $BATCH starting at $(date) ==="

  RESULT=$(curl -s --max-time 600 -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "x-nomi-secret: $SECRET" \
    -d '{"batchSize": 50}')

  echo "Result: $RESULT"

  # Extract processed count
  PROCESSED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('processed',0))" 2>/dev/null)

  if [ "$PROCESSED" = "0" ] || [ -z "$PROCESSED" ]; then
    echo "=== Done! No more restaurants to process. ==="
    break
  fi

  BATCH=$((BATCH + 1))

  # Small delay between batches
  echo "Waiting 10 seconds before next batch..."
  sleep 10
done

echo "=== All batches complete at $(date) ==="
