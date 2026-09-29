from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

# LangChain & RAG Imports
from langchain_community.document_loaders import TextLoader # Reads the text
from langchain_text_splitters import RecursiveCharacterTextSplitter # Splits the text
from langchain_community.vectorstores import Chroma # Database
from langchain_ollama import OllamaEmbeddings # Updated import for Ollama embeddings

# --- SETTINGS ---
CHAT_MODEL = "llama3.2:latest"
EMBED_MODEL = "nomic-embed-text"
DOCUMENT_PATH = "ragtest.txt"

# To start the python app, in terminal:   uvicorn rag_chatbot:app --reload

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


# --- INITIALIZE APP & API CLIENT ---
app = FastAPI(title="Local RAG Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

# --- BUILD KNOWLEDGE BASE ON STARTUP ---
print(f"Loading knowledge base from {DOCUMENT_PATH}...")
try:
    loader = TextLoader(DOCUMENT_PATH)
    docs = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = text_splitter.split_documents(docs)

    embeddings = OllamaEmbeddings(model=EMBED_MODEL)
    vectorstore = Chroma.from_documents(documents=chunks, embedding=embeddings)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 1})

    print("Knowledge base ready!")
except Exception as e:
    print(f"Warning: Could not load {DOCUMENT_PATH}. Chatbot will run without RAG. Error: {e}")
    retriever = None

# --- API ENDPOINT ---
class ChatRequest(BaseModel):
    question: str
    persona: str = "general"

@app.post("/chat")
def chat_with_ai(request: ChatRequest):
    # 1. Verify the LLM is downloaded
    available_models = [m.id for m in client.models.list().data]
    if CHAT_MODEL not in available_models:
        raise HTTPException(
            status_code=404, 
            detail=f"Model '{CHAT_MODEL}' not found. Please run: ollama pull {CHAT_MODEL}"
        )

    # 2. Search the document for context
    context_text = ""
    if retriever:
        relevant_chunks = retriever.invoke(request.question)
        context_text = "\n".join([doc.page_content for doc in relevant_chunks])

    # 3. Construct the prompt with the secret knowledge
    system_prompt = persona.get(request.persona, persona["general"])
    if context_text:
        system_prompt += f"\n\nUSE THIS CONTEXT TO ANSWER THE QUESTION:\n{context_text}"

    # 4. Ask the LLM
    response = client.chat.completions.create(
        model=CHAT_MODEL, 
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.question}
        ]
    )

    return {"answer": response.choices[0].message.content}