@echo off
title SageLite AI Platform Launcher

echo [1/2] Starting FastAPI Backend (Uvicorn)...
start cmd /k "cd /d %~dp0 && .venv\Scripts\activate && uvicorn sagelike_backend.main:app --reload"

echo [2/2] Starting Next.js Frontend...
start cmd /k "cd /d %~dp0\frontend && npm run dev"

echo All services launched! You can close this window.
echo open http://localhost:3000/
pause