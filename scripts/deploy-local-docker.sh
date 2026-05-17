#!/bin/bash

################################################################################
# AI Engineering Platform - Local Docker Deployment Script
# 
# Similar to PRISM.local approach: orchestrates Docker Compose lifecycle with
# common deployment scenarios (fresh, redeploy, reset-db, pull logs, etc.)
#
# Usage:
#   bash scripts/deploy-local-docker.sh [--fresh|--redeploy|--down|--reset-db|--logs|--pull|--status|--help]
#
# Flags:
#   --fresh       : Full reset - removes containers & volumes, rebuilds, fresh start
#   --redeploy    : Rebuild images and restart all containers (default if no flag)
#   --no-build    : Restart containers without rebuilding images
#   --down        : Stop and remove all containers
#   --reset-db    : Clear database volume and restart PostgreSQL
#   --pull        : Pull latest images from registry (if using remote)
#   --logs        : Stream logs from all services
#   --status      : Show container status and port info
#   --help        : Display this help message
#
################################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

# Deployment settings
DETACHED_MODE="-d"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-aiep}"
LOG_LEVEL="${LOG_LEVEL:-debug}"

################################################################################
# Helper Functions
################################################################################

log_info() {
  echo -e "${BLUE}ℹ${NC} $@"
}

log_success() {
  echo -e "${GREEN}✓${NC} $@"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $@"
}

log_error() {
  echo -e "${RED}✗${NC} $@"
}

log_header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $@${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

log_section() {
  echo ""
  echo -e "${YELLOW}→${NC} $@"
}

# Check if Docker and Docker Compose are installed
check_docker() {
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker Desktop."
    exit 1
  fi
  
  if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose."
    exit 1
  fi
  
  log_success "Docker and Docker Compose are installed"
}

# Check if .env file exists, if not copy from .env.example
setup_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
      log_info "Creating .env file from .env.example..."
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      log_success ".env file created"
    else
      log_error ".env.example not found at $ENV_EXAMPLE"
      exit 1
    fi
  fi
}

# Show deployment status
show_status() {
  log_header "Deployment Status"
  
  log_section "Container Status:"
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" ps || true
  
  log_section "Service Ports & URLs:"
  echo ""
  echo "  📡 Orchestration API:     http://localhost:8787"
  echo "  📊 Shared State Service:  http://localhost:8790"
  echo "  🐘 PostgreSQL:            localhost:5432"
  echo "  🔴 Redis:                 localhost:6379"
  echo "  🔍 Weaviate:              http://localhost:8080"
  echo "  📨 Kafka:                 localhost:9092"
  echo "  🐘 Zookeeper:             localhost:2181"
  echo ""
  
  log_section "Service Health:"
  check_service_health
  
  echo ""
}

# Check health of services
check_service_health() {
  # Orchestration API
  if curl -s http://localhost:8787/ > /dev/null 2>&1; then
    log_success "Orchestration API is healthy"
  else
    log_warning "Orchestration API is not responding"
  fi
  
  # PostgreSQL
  if docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" exec -T postgres pg_isready -U aiep_user > /dev/null 2>&1; then
    log_success "PostgreSQL is healthy"
  else
    log_warning "PostgreSQL is not healthy"
  fi
  
  # Redis
  if docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" exec -T redis redis-cli ping > /dev/null 2>&1; then
    log_success "Redis is healthy"
  else
    log_warning "Redis is not healthy"
  fi
  
  # Weaviate
  if curl -s http://localhost:8080/v1/.well-known/ready > /dev/null 2>&1; then
    log_success "Weaviate is healthy"
  else
    log_warning "Weaviate is not responding"
  fi
}

# Fresh deployment (full reset)
deploy_fresh() {
  log_header "Fresh Deployment - Full Reset"
  
  log_section "Stopping and removing all containers..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down --remove-orphans -v 2>/dev/null || true
  log_success "Containers and volumes removed"
  
  log_section "Building images..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" build --no-cache
  log_success "Images built"
  
  log_section "Starting all services..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up $DETACHED_MODE
  log_success "Services started"
  
  log_section "Waiting for services to become healthy..."
  wait_for_services
  
  show_status
  show_next_steps "fresh"
}

# Redeploy (rebuild and restart)
deploy_redeploy() {
  local no_build=${1:-false}
  
  log_header "Redeploying Services"
  
  if [ "$no_build" = "false" ]; then
    log_section "Building images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" build
    log_success "Images built"
  fi
  
  log_section "Stopping services..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down --remove-orphans
  log_success "Services stopped"
  
  log_section "Starting services..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up $DETACHED_MODE
  log_success "Services started"
  
  log_section "Waiting for services to become healthy..."
  wait_for_services
  
  show_status
  show_next_steps "redeploy"
}

# Down (stop all services)
deploy_down() {
  log_header "Stopping All Services"
  
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down --remove-orphans
  
  log_success "All services stopped and containers removed"
  echo ""
}

# Reset database
reset_database() {
  log_header "Resetting Database"
  
  log_section "Stopping PostgreSQL..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down postgres --remove-orphans -v
  log_success "PostgreSQL stopped and volume removed"
  
  log_section "Starting PostgreSQL..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d postgres
  log_success "PostgreSQL started"
  
  log_section "Waiting for PostgreSQL to be ready..."
  sleep 10
  
  log_success "Database reset complete"
  echo ""
}

# Pull latest images
pull_images() {
  log_header "Pulling Latest Images"
  
  log_section "Pulling images from registry..."
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" pull
  
  log_success "Images pulled"
  echo ""
}

# Stream logs
show_logs() {
  log_header "Service Logs (Press Ctrl+C to stop)"
  
  docker-compose -f "$DOCKER_COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" logs -f --tail=100
}

# Wait for services to become healthy
wait_for_services() {
  local max_attempts=60
  local attempt=0
  
  log_info "Checking service health..."
  
  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    
    # Check Orchestration API
    if curl -s http://localhost:8787/ > /dev/null 2>&1; then
      log_success "✓ Orchestration API is healthy"
      return 0
    fi
    
    if [ $((attempt % 10)) -eq 0 ]; then
      log_info "Still waiting for services to be healthy... ($attempt/$max_attempts)"
    fi
    
    sleep 1
  done
  
  log_warning "Services did not become healthy within ${max_attempts} seconds"
  return 1
}

# Show next steps
show_next_steps() {
  local deploy_type=$1
  
  log_header "Next Steps"
  
  echo "1. Verify all services are running:"
  echo "   bash scripts/deploy-local-docker.sh --status"
  echo ""
  
  echo "2. Test the Orchestration API:"
  echo "   curl http://localhost:8787/"
  echo ""
  
  echo "3. View logs from services:"
  echo "   bash scripts/deploy-local-docker.sh --logs"
  echo ""
  
  echo "4. When done, stop services:"
  echo "   bash scripts/deploy-local-docker.sh --down"
  echo ""
  
  log_success "Deployment complete!"
}

# Display help message
show_help() {
  cat << EOF
${BLUE}AI Engineering Platform - Local Docker Deployment${NC}

${YELLOW}USAGE:${NC}
  bash scripts/deploy-local-docker.sh [OPTIONS]

${YELLOW}OPTIONS:${NC}
  --fresh         Full reset: remove containers, rebuild, fresh start
  --redeploy      Rebuild images and restart containers (default)
  --no-build      Restart containers without rebuilding
  --down          Stop and remove all containers
  --reset-db      Clear database and restart PostgreSQL
  --pull          Pull latest images from registry
  --logs          Stream logs from all services
  --status        Show container status and port info
  --help          Display this help message

${YELLOW}EXAMPLES:${NC}
  # Fresh deployment (full reset)
  bash scripts/deploy-local-docker.sh --fresh

  # Redeploy with rebuild
  bash scripts/deploy-local-docker.sh --redeploy

  # Restart without rebuild
  bash scripts/deploy-local-docker.sh --redeploy --no-build

  # Stop all services
  bash scripts/deploy-local-docker.sh --down

  # Check status
  bash scripts/deploy-local-docker.sh --status

${YELLOW}SERVICE ENDPOINTS:${NC}
  Orchestration API:    http://localhost:8787
  Shared State Service: http://localhost:8790
  PostgreSQL:           localhost:5432
  Redis:                localhost:6379
  Weaviate:             http://localhost:8080
  Kafka:                localhost:9092

${YELLOW}CONFIGURATION:${NC}
  Environment file: .env
  Docker Compose:   docker-compose.yml
  Dockerfile:       Dockerfile

For more information, see docs/DEPLOYMENT_GUIDE.md

EOF
}

################################################################################
# Main Script Logic
################################################################################

main() {
  local command="${1:---redeploy}"
  local no_build=false
  
  # Check if Docker is installed
  check_docker
  
  # Setup .env file if needed
  setup_env_file
  
  # Parse command
  case "$command" in
    --fresh)
      deploy_fresh
      ;;
    --redeploy)
      # Check if --no-build flag is provided
      if [ "${2:-}" = "--no-build" ]; then
        deploy_redeploy "true"
      else
        deploy_redeploy "false"
      fi
      ;;
    --no-build)
      deploy_redeploy "true"
      ;;
    --down)
      deploy_down
      ;;
    --reset-db)
      reset_database
      ;;
    --pull)
      pull_images
      ;;
    --logs)
      show_logs
      ;;
    --status)
      show_status
      ;;
    --help)
      show_help
      ;;
    *)
      log_error "Unknown command: $command"
      echo ""
      show_help
      exit 1
      ;;
  esac
}

# Run main function
main "$@"
