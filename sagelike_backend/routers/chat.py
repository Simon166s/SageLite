from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from ..config import CHAT_MODEL, PERSONAS
from ..rag import get_relevant_context

router = APIRouter(prefix="/chat", tags=["Chat"])

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

class ChatRequest(BaseModel):
    question: str
    persona: str = "general"
    language: str = "English"  # Default language

@router.post("/")
def chat_with_ai(request: ChatRequest):
    available_models = [m.id for m in client.models.list().data]
    if CHAT_MODEL not in available_models:
        raise HTTPException(
            status_code=404, 
            detail=f"Model '{CHAT_MODEL}' not found. Please run: ollama pull {CHAT_MODEL}"
        )

    context_text = get_relevant_context(request.question)

    # 1. Base persona prompt
    system_prompt = PERSONAS.get(request.persona, PERSONAS["general"])

    # 2. Dynamic language instruction injection
    language_directives = {
        "English": "Respond clearly in English.",
        "French": "Réponds entièrement en français (French language).",
        "Spanish": "Responde completamente en español.",
        "German": "Antworte vollständig auf Deutsch."
    }
    lang_instruction = language_directives.get(request.language, "Respond in English.")
    system_prompt += f"\n\nLANGUAGE RULE: {lang_instruction}"

    # 3. RAG Context injection
    if context_text:
        system_prompt += f"\n\nUSE THIS CONTEXT TO ANSWER THE QUESTION:\n{context_text}"

    def generate():
        response = client.chat.completions.create(
            model=CHAT_MODEL, 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.question}
            ],
            stream=True
        )
        for chunk in response:
            content = chunk.choices[0].delta.content
            if content:
                yield content

    return StreamingResponse(generate(), media_type="text/plain")