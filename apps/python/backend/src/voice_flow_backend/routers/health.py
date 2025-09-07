from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def health():
    return {"ok": True}
