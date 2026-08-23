#!/usr/bin/env bash
set -euo pipefail

# Required only in the shell that runs this test. Never commit either value.
: "${PS_LOUNGE_TEST_EMAIL:?Set PS_LOUNGE_TEST_EMAIL for an authorized test account}"
: "${PS_LOUNGE_TEST_PASSWORD:?Set PS_LOUNGE_TEST_PASSWORD for the authorized test account}"

source .env.local

login_response="$(curl -sS --request POST "${VITE_SUPABASE_URL}/auth/v1/token?grant_type=password" \
  --header "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  --header 'Content-Type: application/json' \
  --data "$(jq -nc --arg email "$PS_LOUNGE_TEST_EMAIL" --arg password "$PS_LOUNGE_TEST_PASSWORD" '{email:$email,password:$password}')")"
access_token="$(printf '%s' "$login_response" | jq -r '.access_token // empty')"
test -n "$access_token"

device_json="$(curl -sS --request GET "${VITE_SUPABASE_URL}/rest/v1/devices?select=id,branch_id&is_active=eq.true&order=id.asc&limit=1" \
  --header "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${access_token}")"
branch_id="$(printf '%s' "$device_json" | jq -r '.[0].branch_id // empty')"
device_id="$(printf '%s' "$device_json" | jq -r '.[0].id // empty')"
test -n "$branch_id"
test -n "$device_id"

request_id="$(cat /proc/sys/kernel/random/uuid)"
payload="$(jq -nc --arg requestId "$request_id" --arg branchId "$branch_id" --argjson deviceId "$device_id" '{action:"queueDeviceCommand",requestId:$requestId,branchId:$branchId,deviceId:$deviceId,type:"health_probe",payload:{source:"runtime-smoke"}}')"
first_file="$(mktemp)"
second_file="$(mktemp)"
direct_dml_file="$(mktemp)"
legacy_rpc_file="$(mktemp)"
trap 'rm -f "$first_file" "$second_file" "$direct_dml_file" "$legacy_rpc_file"' EXIT

invoke_command() {
  local response_file="$1"
  curl -sS -o "$response_file" -w '%{http_code}' --request POST "${VITE_SUPABASE_URL}/functions/v1/command-api" \
    --header "apikey: ${VITE_SUPABASE_ANON_KEY}" \
    --header "Authorization: Bearer ${access_token}" \
    --header 'Content-Type: application/json' \
    --data "$payload"
}

first_status="$(invoke_command "$first_file")"
second_status="$(invoke_command "$second_file")"
test "$first_status" = "200"
test "$second_status" = "200"
first_id="$(jq -r '.data.command.id // empty' "$first_file")"
second_id="$(jq -r '.data.command.id // empty' "$second_file")"
test -n "$first_id"
test "$first_id" = "$second_id"
cmp -s <(jq -S '.data' "$first_file") <(jq -S '.data' "$second_file")

direct_dml_status="$(curl -sS -o "$direct_dml_file" -w '%{http_code}' --request POST "${VITE_SUPABASE_URL}/rest/v1/expenses" \
  --header "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${access_token}" \
  --header 'Content-Type: application/json' \
  --header 'Prefer: return=representation' \
  --data "$(jq -nc --arg branchId "$branch_id" '{branch_id:$branchId,name:"runtime-security-smoke",amount:0,category:"security",is_active:true,sort_order:999999}')")"
legacy_rpc_status="$(curl -sS -o "$legacy_rpc_file" -w '%{http_code}' --request POST "${VITE_SUPABASE_URL}/rest/v1/rpc/stop_session" \
  --header "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  --header "Authorization: Bearer ${access_token}" \
  --header 'Content-Type: application/json' \
  --data '{"p_session_id":"00000000-0000-0000-0000-000000000000"}')"
[[ ! "$direct_dml_status" =~ ^2 ]]
[[ ! "$legacy_rpc_status" =~ ^2 ]]

jq -n \
  --arg requestId "$request_id" \
  --arg commandId "$first_id" \
  --argjson firstStatus "$first_status" \
  --argjson secondStatus "$second_status" \
  --argjson directDmlStatus "$direct_dml_status" \
  --argjson legacyRpcStatus "$legacy_rpc_status" \
  '{requestId:$requestId,commandId:$commandId,firstStatus:$firstStatus,secondStatus:$secondStatus,directDmlStatus:$directDmlStatus,legacyRpcStatus:$legacyRpcStatus}'
