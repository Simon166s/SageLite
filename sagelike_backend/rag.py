from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings
from sagelike_backend.config import DOCUMENT_PATH, EMBED_MODEL

# Global retriever storage
_retriever = None

def initialize_knowledge_base():
    """Loads text, creates chunks, builds Chroma vector store, and sets up retriever."""
    global _retriever
    print(f"Loading knowledge base from {DOCUMENT_PATH}...")
    try:
        loader = TextLoader(DOCUMENT_PATH)
        docs = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = text_splitter.split_documents(docs)

        embeddings = OllamaEmbeddings(model=EMBED_MODEL)
        vectorstore = Chroma.from_documents(documents=chunks, embedding=embeddings)
        _retriever = vectorstore.as_retriever(search_kwargs={"k": 1})

        print("Knowledge base ready!")
    except Exception as e:
        print(f"Warning: Could not load {DOCUMENT_PATH}. RAG disabled. Error: {e}")
        _retriever = None

def get_relevant_context(question: str) -> str:
    """Queries the vector database and returns matching context chunks."""
    if not _retriever:
        return ""
    try:
        relevant_chunks = _retriever.invoke(question)
        return "\n".join([doc.page_content for doc in relevant_chunks])
    except Exception as e:
        print(f"Retrieval error: {e}")
        return ""