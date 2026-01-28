#!/bin/bash

# Test Form Submission Script
# This script tests the email drip campaign system by simulating a form submission

# Configuration - Update these values
EMAIL="fratosteven@gmail.com"
NAME="Test User"
ADDRESS="123 Main Street"
TOWN="Florence"
ZIPCODE="08518"
PHONE="609-555-1234"
INTEREST="selling"  # Options: selling, buying, both, investment, consultation

# URLs - Update SUPABASE_URL with your project URL
SITE_URL="${SITE_URL:-https://stevenfrato.com}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

echo "=========================================="
echo "Email Drip Campaign Test"
echo "=========================================="
echo ""
echo "Testing with:"
echo "  Email: $EMAIL"
echo "  Name: $NAME"
echo "  Address: $ADDRESS"
echo "  Town: $TOWN"
echo "  Zipcode: $ZIPCODE"
echo "  Interest: $INTEREST"
echo ""

# Option 1: Test via Supabase Edge Function directly
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
  echo "Testing Supabase Edge Function directly..."
  echo ""

  curl -X POST "$SUPABASE_URL/functions/v1/handle-form-submission" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -d "{
      \"email\": \"$EMAIL\",
      \"name\": \"$NAME\",
      \"address\": \"$ADDRESS\",
      \"town\": \"$TOWN\",
      \"zipcode\": \"$ZIPCODE\",
      \"phone\": \"$PHONE\",
      \"interest\": \"$INTEREST\",
      \"source-location\": \"$ZIPCODE\"
    }"

  echo ""
  echo ""
  echo "Done! Check your email for the welcome message."
  echo "Check Supabase dashboard for the lead record."
else
  echo "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  echo ""
  echo "Example:"
  echo "  export SUPABASE_URL=https://yourproject.supabase.co"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=eyJ..."
  echo "  ./scripts/test-form-submission.sh"
fi

echo ""
echo "=========================================="
