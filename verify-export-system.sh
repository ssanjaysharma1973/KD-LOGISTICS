#!/bin/bash

# =============================================================================
# Pre-Deployment Verification Script
# Tests all components of the Automated E-Way Bill Export System
# Usage: bash verify-export-system.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

# Functions
print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════${NC}\n"
}

check_pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1"
  ((PASS++))
}

check_fail() {
  echo -e "${RED}✗ FAIL${NC}: $1"
  ((FAIL++))
}

check_warn() {
  echo -e "${YELLOW}⚠ WARN${NC}: $1"
  ((WARN++))
}

# =============================================================================
print_header "AUTOMATED E-WAY BILL EXPORT SYSTEM - PRE-DEPLOYMENT CHECK"

# =============================================================================
print_header "1. ENVIRONMENT & PREREQUISITES"

# Check Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  if [[ "$NODE_VERSION" == v1[4-9]* ]] || [[ "$NODE_VERSION" == v[2-9][0-9]* ]]; then
    check_pass "Node.js installed: $NODE_VERSION"
  else
    check_fail "Node.js version too old: $NODE_VERSION (need 14+)"
  fi
else
  check_fail "Node.js not found"
fi

# Check npm
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm --version)
  check_pass "npm installed: v$NPM_VERSION"
else
  check_fail "npm not found"
fi

# Check .env file
if [ -f ".env" ]; then
  check_pass ".env file exists"
else
  check_warn ".env file not found (optional if vars exported)"
fi

# =============================================================================
print_header "2. MASTER API KEY CONFIGURATION"

# Check MASTER_API_KEY env var
if [ -n "$MASTER_API_KEY" ]; then
  if [ ${#MASTER_API_KEY} -ge 32 ]; then
    check_pass "MASTER_API_KEY set (length: ${#MASTER_API_KEY})"
  else
    check_warn "MASTER_API_KEY too short (length: ${#MASTER_API_KEY}, need 32+)"
  fi
else
  if grep -q "MASTER_API_KEY=" .env 2>/dev/null; then
    check_warn "MASTER_API_KEY in .env but not exported to shell"
    echo "         Run: source .env"
  else
    check_fail "MASTER_API_KEY not found in .env or environment"
  fi
fi

# =============================================================================
print_header "3. DEPENDENCIES"

# Check package.json
if [ -f "package.json" ]; then
  check_pass "package.json exists"
  
  # Check for ExcelJS
  if grep -q "exceljs" package.json; then
    check_pass "exceljs installed in package.json"
  else
    check_warn "exceljs not in package.json (required for Excel export)"
  fi
else
  check_fail "package.json not found"
fi

# Test ExcelJS
if node -e "require('exceljs')" 2>/dev/null; then
  check_pass "exceljs module loadable"
else
  check_warn "exceljs not installed in node_modules"
  echo "         Run: npm install exceljs"
fi

# =============================================================================
print_header "4. CODEBASE"

# Check core files
FILES_NEEDED=(
  "src/middleware/masterKeyAuth.js"
  "src/services/excelExport.js"
  "src/services/exportScheduler.js"
  "src/middleware/auditLogger.js"
)

for file in "${FILES_NEEDED[@]}"; do
  if [ -f "$file" ]; then
    SIZE=$(wc -c < "$file")
    check_pass "$file ($(($SIZE / 1024)) KB)"
  else
    check_fail "$file not found"
  fi
done

# Check if server.js has export endpoints
if grep -q "export/xlsx" server.js 2>/dev/null; then
  check_pass "Export endpoints integrated in server.js"
else
  check_fail "Export endpoints not found in server.js"
fi

# =============================================================================
print_header "5. DATABASE"

# Check client databases
DB_COUNT=0
if [ -d "data" ] || [ -d "/data" ]; then
  DATA_DIR="data"
  if [ ! -d "$DATA_DIR" ]; then
    DATA_DIR="/data"
  fi
  
  DB_COUNT=$(find "$DATA_DIR" -name "client_*.db" -type f 2>/dev/null | wc -l)
  if [ $DB_COUNT -gt 0 ]; then
    check_pass "Found $DB_COUNT client database(s)"
  else
    check_warn "No client_*.db files found (will be created on first insert)"
  fi
else
  check_warn "data/ or /data directory not found"
fi

# =============================================================================
print_header "6. FILE SYSTEM"

# Check export directory
if [ -d "/data/exports" ]; then
  check_pass "/data/exports exists"
  
  # Check permissions
  if [ -w "/data/exports" ]; then
    check_pass "/data/exports is writable"
  else
    check_fail "/data/exports not writable (run: sudo chmod 755 /data/exports)"
  fi
else
  check_warn "/data/exports not found (will be created on first export)"
fi

# Check logs directory
if [ -d "logs" ]; then
  check_pass "logs/ directory exists"
  if [ -w "logs" ]; then
    check_pass "logs/ is writable"
  else
    check_warn "logs/ not writable"
  fi
else
  check_warn "logs/ directory not found (will be created on first log)"
fi

# =============================================================================
print_header "7. SERVER CONNECTIVITY"

# Try to connect to running server
if command -v curl &> /dev/null; then
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    check_pass "Server running on http://localhost:3000"
    
    # Test export endpoint exists
    if curl -s -H "Authorization: MasterKey test" \
           http://localhost:3000/api/eway-bills-hub/export/status > /dev/null 2>&1; then
      check_pass "Export endpoints accessible"
    else
      check_warn "Export endpoints not responding (may need API key)"
    fi
  else
    check_warn "Cannot reach http://localhost:3000 (server not running)"
    echo "         Start server with: npm start"
  fi
else
  check_warn "curl not found (cannot test connectivity)"
fi

# =============================================================================
print_header "8. CONFIGURATION VALIDATION"

# Check for required environment variables in .env
if [ -f ".env" ]; then
  echo "Checking .env variables..."
  
  if grep -q "MASTER_API_KEY=" .env; then
    check_pass "MASTER_API_KEY in .env"
  else
    check_fail "MASTER_API_KEY missing from .env"
  fi
  
  if grep -q "EXPORT_INTERVAL=" .env; then
    INTERVAL=$(grep EXPORT_INTERVAL= .env | cut -d= -f2)
    check_pass "EXPORT_INTERVAL set to: $INTERVAL"
  else
    check_warn "EXPORT_INTERVAL not set (will default to daily)"
  fi
  
  if grep -q "EXPORT_HOUR=" .env; then
    HOUR=$(grep EXPORT_HOUR= .env | cut -d= -f2)
    check_pass "EXPORT_HOUR set to: $HOUR"
  else
    check_warn "EXPORT_HOUR not set (will default to 2)"
  fi
  
  if grep -q "EXPORT_CLIENTS=" .env; then
    CLIENTS=$(grep EXPORT_CLIENTS= .env | cut -d= -f2)
    check_pass "EXPORT_CLIENTS configured: $CLIENTS"
  else
    check_warn "EXPORT_CLIENTS not set (export won't auto-run)"
  fi
fi

# =============================================================================
print_header "9. API ENDPOINT TESTS"

if [ -n "$MASTER_API_KEY" ] && command -v curl &> /dev/null; then
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Testing API endpoints with Master Key..."
    
    # Test status endpoint
    STATUS=$(curl -s -H "Authorization: MasterKey $MASTER_API_KEY" \
      http://localhost:3000/api/eway-bills-hub/export/status 2>/dev/null)
    
    if echo "$STATUS" | grep -q "lastRun\|success"; then
      check_pass "GET /api/eway-bills-hub/export/status → OK"
    else
      check_warn "Export status endpoint not responding as expected"
    fi
    
    # Test recent endpoint
    RECENT=$(curl -s -H "Authorization: MasterKey $MASTER_API_KEY" \
      http://localhost:3000/api/eway-bills-hub/export/recent 2>/dev/null)
    
    if echo "$RECENT" | grep -q "exports\|success\|error"; then
      check_pass "GET /api/eway-bills-hub/export/recent → OK"
    fi
  fi
fi

# =============================================================================
print_header "10. SUMMARY"

TOTAL=$((PASS + FAIL + WARN))

echo -e "${GREEN}Passed: $PASS${NC}"
if [ $WARN -gt 0 ]; then
  echo -e "${YELLOW}Warnings: $WARN${NC}"
fi
if [ $FAIL -gt 0 ]; then
  echo -e "${RED}Failed: $FAIL${NC}"
fi

echo -e "\nTotal checks: $TOTAL"

# =============================================================================
print_header "11. QUICK START GUIDE"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ SYSTEM READY FOR DEPLOYMENT${NC}\n"
  
  echo "Next steps:"
  echo ""
  echo "1. Export environment variables (if using .env):"
  echo "   source .env"
  echo ""
  echo "2. Start the server (it will auto-start the scheduler):"
  echo "   npm start"
  echo ""
  echo "3. Monitor the exports:"
  echo "   curl -H \"Authorization: MasterKey \$MASTER_API_KEY\" \\"
  echo "     http://localhost:3000/api/eway-bills-hub/export/status | jq"
  echo ""
  echo "4. Check generated files:"
  echo "   ls -la /data/exports/"
  echo ""
  
else
  echo -e "${RED}⚠ ISSUES FOUND - PLEASE FIX BEFORE DEPLOYMENT${NC}\n"
  echo "Actions needed:"
  echo ""
  
  if [ $FAIL -gt 0 ]; then
    echo "1. Fix the ${RED}$FAIL FAILED${NC} checks above"
    echo "2. Re-run this script"
    echo ""
  fi
fi

# =============================================================================
print_header "DOCUMENTATION"

echo "For more details, see:"
echo "  • docs/AUTOMATED-EXPORT-SETUP.md - Detailed setup guide"
echo "  • docs/QUICK-START-EXPORT.md - Quick start checklist"
echo "  • docs/DEPLOYMENT-GUIDE.md - Full deployment guide"
echo "  • docs/LEVEL-5-AUDIT-IMPLEMENTATION.md - Audit system docs"

# =============================================================================

# Exit code
if [ $FAIL -gt 0 ]; then
  echo ""
  echo -e "${RED}Verification completed with $FAIL failures.${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}Verification completed successfully!${NC}"
  exit 0
fi
