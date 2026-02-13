from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import FRONTEND_ORIGINS, MOCK_MODE

app = FastAPI(title="PET/FCE AI English Learning Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from routers import vocab, grammar, reading, listening

app.include_router(vocab.router, prefix="/api/vocab", tags=["Vocabulary"])
app.include_router(grammar.router, prefix="/api/grammar", tags=["Grammar"])
app.include_router(reading.router, prefix="/api/reading", tags=["Reading"])
app.include_router(listening.router, prefix="/api/listening", tags=["Listening"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "mock_mode": MOCK_MODE}
