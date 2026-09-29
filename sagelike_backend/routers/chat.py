from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from sagelike_backend.config import CHAT_MODEL, PERSONAS
from sagelike_backend.rag import get_relevant_context

router = APIRouter(prefix="/chat", tags=["Chat"])

# Connect to local Ollama engine
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

class ChatRequest(BaseModel):
    question: str
    persona: str = "general"

@router.post("/")
def chat_with_ai(request: ChatRequest):
    # 1. Verify the LLM is downloaded
    available_models = [m.id for m in client.models.list().data]
    if CHAT_MODEL not in available_models:
        raise HTTPException(
            status_code=404, 
            detail=f"Model '{CHAT_MODEL}' not found. Please run: ollama pull {CHAT_MODEL}"
        )

    # 2. Fetch context from rag.py
    context_text = get_relevant_context(request.question)

    # 3. Construct the prompt with persona and context
    system_prompt = PERSONAS.get(request.persona, PERSONAS["general"])
    if context_text:
        system_prompt += f"\n\nUSE THIS CONTEXT TO ANSWER THE QUESTION:\n{context_text}"

    # 4. Generate response via Ollama
    response = client.chat.completions.create(
        model=CHAT_MODEL, 
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.question}
        ]
    )

    return {"answer": response.choices[0].message.content}