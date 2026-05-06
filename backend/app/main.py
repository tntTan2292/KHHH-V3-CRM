import time
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import analytics, import_data, customers, potential, export_data, actions, auth, nodes, admin_hierarchy, admin_personnel, admin_roles, reports, superadmin, bot

# Create DB tables
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Hệ thống Quản lý Khách hàng Bưu điện TP Huế - v3.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"API: {request.method} {request.url.path} - Processing Time: {process_time:.4f}s")
    response.headers["X-Process-Time"] = str(process_time)
    return response

@app.get("/api/test-v3")
async def test_v3():
    return {"status": "ok", "message": "This is V3.0-Inclusive-Fix"}

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "3.0-overhaul"}

app.include_router(auth.router)
app.include_router(nodes.router)
app.include_router(analytics.router)
app.include_router(import_data.router)
app.include_router(customers.router)
app.include_router(potential.router)
app.include_router(actions.router)
app.include_router(export_data.router)
app.include_router(admin_hierarchy.router)
app.include_router(admin_personnel.router)
app.include_router(admin_personnel.users_router)
app.include_router(admin_roles.router)
app.include_router(reports.router)
app.include_router(superadmin.router)
app.include_router(bot.router)

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Khởi động KHHH Management System...")
