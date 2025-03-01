#!/bin/sh
# wait-for-dynamodb.sh

set -e

host="$1"
shift
cmd="$@"

until curl -s "http://$host:8000" > /dev/null; do
  >&2 echo "DynamoDB is unavailable - sleeping"
  sleep 1
done

>&2 echo "DynamoDB is up - executing command"
exec $cmd
