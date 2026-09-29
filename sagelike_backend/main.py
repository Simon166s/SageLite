from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sagelike_backend.routers import chat
from sagelike_backend.rag import initialize_knowledge_base

app = FastAPI(title="Local RAG Chatbot")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# Initialize vector database on application startup
initialize_knowledge_base()

# Register API routers
app.include_router(chat.router)

@app.get("/")
def root():
    return {"status": "online", "message": "SageLite modular backend is running successfully."}

#uvicorn sagelike_backend.main:app --reload in terminal
#http://127.0.0.1:8000/docs