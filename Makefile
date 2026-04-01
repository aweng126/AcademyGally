.PHONY: up down restart build logs ps clean help

# ── One-command deploy ────────────────────────────────────────────────────────
up:
	docker compose up --build -d
	@echo ""
	@echo "  App:      http://localhost:3000"
	@echo "  API docs: http://localhost:8000/docs"
	@echo ""

# ── Stop all services ─────────────────────────────────────────────────────────
down:
	docker compose down

# ── Rebuild and restart ───────────────────────────────────────────────────────
restart:
	docker compose down
	docker compose up --build -d
	@echo ""
	@echo "  App:      http://localhost:3000"
	@echo "  API docs: http://localhost:8000/docs"
	@echo ""

# ── Build images only (no start) ─────────────────────────────────────────────
build:
	docker compose build

# ── Follow live logs ─────────────────────────────────────────────────────────
logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

# ── Show running containers ───────────────────────────────────────────────────
ps:
	docker compose ps

# ── Remove containers, volumes, and cached images ────────────────────────────
clean:
	docker compose down -v --rmi local

# ── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  make up            Build and start all services (detached)"
	@echo "  make down          Stop all services"
	@echo "  make restart       Stop, rebuild, and start"
	@echo "  make build         Build images only"
	@echo "  make logs          Follow logs for all services"
	@echo "  make logs-backend  Follow backend logs only"
	@echo "  make logs-frontend Follow frontend logs only"
	@echo "  make ps            Show running containers"
	@echo "  make clean         Remove containers, volumes, and local images"
	@echo ""
