from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import threading
import time
from .routers import chat
from .rag import initialize_knowledge_base
from .database import init_db

app = FastAPI(title="SageLite Backend", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)

@app.on_event("startup")
async def startup_event():
    init_db()  # Automatically creates sagelike.db
    initialize_knowledge_base()

@app.post("/shutdown")
def shutdown_server():
    def kill_process():
        time.sleep(0.5)
        os._exit(0)
    threading.Thread(target=kill_process).start()
    return {"status": "Shutting down SageLite backend..."}