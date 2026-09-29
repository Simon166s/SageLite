from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from ..config import CHAT_MODEL, PERSONAS
from ..rag import get_relevant_context
from ..database import SessionLocal, ThreadModel, MessageModel

router = APIRouter(prefix="/chat", tags=["Chat"])
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

class NewThreadRequest(BaseModel):
    title: str = "New Conversation"

class ChatRequest(BaseModel):
    question: str
    persona: str = "general"
    language: str = "English"
    thread_id: int | None = None

# 1. Explicit thread creation endpoint
@router.post("/threads/new")
def create_thread(req: NewThreadRequest):
    db = SessionLocal()
    new_thread = ThreadModel(title=req.title)
    db.add(new_thread)
    db.commit()
    db.refresh(new_thread)
    thread_id = new_thread.id
    db.close()
    return {"id": thread_id, "title": new_thread.title}

# 2. Chat streaming endpoint
@router.post("/")
def chat_with_ai(request: ChatRequest):
    available_models = [m.id for m in client.models.list().data]
    if CHAT_MODEL not in available_models:
        raise HTTPException(status_code=404, detail=f"Model '{CHAT_MODEL}' not found.")

    db = SessionLocal()

    # Fallback thread creation if thread_id is missing
    active_thread_id = request.thread_id
    if not active_thread_id:
        title = (request.question[:30] + "...") if len(request.question) > 30 else request.question
        new_thread = ThreadModel(title=title)
        db.add(new_thread)
        db.commit()
        db.refresh(new_thread)
        active_thread_id = new_thread.id

    # Save incoming User message to SQLite
    user_msg = MessageModel(thread_id=active_thread_id, role="user", content=request.question)
    db.add(user_msg)
    db.commit()

    # Fetch complete thread history to provide memory to the LLM
    past_messages = (
        db.query(MessageModel)
        .filter(MessageModel.thread_id == active_thread_id)
        .order_by(MessageModel.created_at.asc())
        .all()
    )
    db.close()

    # Build prompt instructions
    context_text = get_relevant_context(request.question)
    system_prompt = PERSONAS.get(request.persona, PERSONAS["general"])

    language_directives = {
        "English": "Respond clearly in English.",
        "French": "Réponds entièrement en français (French language).",
        "Spanish": "Responde completamente en español.",
        "German": "Antworte vollständig auf Deutsch."
    }
    system_prompt += f"\n\nLANGUAGE RULE: {language_directives.get(request.language, 'Respond in English.')}"
    if context_text:
        system_prompt += f"\n\nUSE THIS CONTEXT TO ANSWER THE QUESTION:\n{context_text}"

    # Build message payload containing prior turns
    openai_messages = [{"role": "system", "content": system_prompt}]
    for msg in past_messages:
        openai_messages.append({"role": msg.role, "content": msg.content})

    def generate():
        full_response = ""
        try:
            response = client.chat.completions.create(
                model=CHAT_MODEL,
                messages=openai_messages,
                stream=True
            )
            for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    full_response += content
                    yield content
        finally:
            # Save the full assistant response to SQLite upon stream completion
            bg_db = SessionLocal()
            try:
                assistant_msg = MessageModel(thread_id=active_thread_id, role="assistant", content=full_response)
                bg_db.add(assistant_msg)
                bg_db.commit()
            finally:
                bg_db.close()

    return StreamingResponse(generate(), media_type="text/plain")

@router.get("/threads")
def get_threads():
    db = SessionLocal()
    threads = db.query(ThreadModel).order_by(ThreadModel.created_at.desc()).all()
    result = [{"id": t.id, "title": t.title, "created_at": t.created_at} for t in threads]
    db.close()
    return result

@router.get("/threads/{thread_id}/messages")
def get_thread_messages(thread_id: int):
    db = SessionLocal()
    messages = (
        db.query(MessageModel)
        .filter(MessageModel.thread_id == thread_id)
        .order_by(MessageModel.created_at.asc())
        .all()
    )
    result = [{"role": m.role, "content": m.content} for m in messages]
    db.close()
    return result

@router.delete("/threads/{thread_id}")
def delete_thread(thread_id: int):
    db = SessionLocal()
    thread = db.query(ThreadModel).filter(ThreadModel.id == thread_id).first()
    if thread:
        db.delete(thread)
        db.commit()
    db.close()
    return {"status": "success"}