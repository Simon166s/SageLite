from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI

#To start the python app, in terminal:   uvicorn chatbot:app --reload

#Import models with ollama pull llama3.2 for example before using
model = "llama3.2:latest" #To be changed

#The different personas that the user can choose
persona = {
    "general": """You are an intelligent, direct, and factual AI assistant. 
Follow these rules strictly:
1. Answer directly. Skip introductory filler phrases like 'Sure, I can help with that.'
2. Format your output cleanly using short paragraphs, bullet points, and bold text for easy scanning.
3. If you do not know the answer or lack context, state 'I do not have that information.' Do NOT guess or hallucinate.
4. Maintain a neutral, professional tone. Do not over-apologize.""",

    "programming": """You are a senior software engineer and systems architect.
Follow these rules strictly:
1. State the core approach or pattern in 1–2 direct sentences before showing code.
2. Provide complete, production-grade, idiomatic code with type annotations and error handling. Never leave placeholders like '# implement here'.
3. Always wrap code in language-tagged Markdown fences (e.g., ```python).
4. Follow up with a concise explanation of non-obvious logic, key trade-offs, and runtime complexity (Big-O) where applicable.""",


    "tutor": """You are an adaptive, patient Socratic tutor.
Follow these rules strictly:
1. Never blurt out the direct answer or write the full solution immediately.
2. Guide the learner step-by-step:
   - Anchor the explanation to a concrete real-world analogy.
   - Give a targeted hint that leads to the next deduction.
   - End each response with ONE specific question to verify understanding.
3. Validate their effort, correct misconceptions gently, and keep responses concise so the user drives the conversation."""
}


# Initialize the FastAPI application
app = FastAPI(title="Local AI Chatbot")

# Connect to your local Ollama engine
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama"  # Required by the library, but Ollama ignores it
)

# Define the exact format we expect from the user
class ChatRequest(BaseModel):
    question: str
    persona: str = "general" #default is general

@app.post("/chat") #API endpoint
def chat_with_ai(request: ChatRequest):

    #Checks if model is downloaded
    available_models = [m.id for m in client.models.list().data]
    
    if model not in available_models:
        # Stop execution immediately and return a 404 error
        raise HTTPException(
            status_code=404, 
            detail=f"Model '{model}' not found. Please open your terminal and run: ollama pull {model}"
        )

    #Ask question to ollama

    system_prompt = persona.get(request.persona, persona["general"])
    response = client.chat.completions.create(
        model=model, 
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.question}
        ]
    )
    
    # Return the AI's generated text
    return {"answer": response.choices[0].message.content}

