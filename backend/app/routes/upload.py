from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from typing import Dict
import os
import uuid
import shutil
from .deps import get_current_user
from ..schemas import UserResponse

router = APIRouter()

UPLOAD_DIR = "uploads"

# Ensure the upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024 # 5 MB

@router.post("", response_model=Dict[str, str])
async def upload_file(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Upload a file. Max 5MB.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    try:
        # Read file in chunks to enforce size limit and avoid OOM
        content = bytearray()
        while True:
            chunk = await file.read(1024 * 1024) # 1MB chunks
            if not chunk:
                break
            content.extend(chunk)
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large. Max 5MB allowed.")
        
        content_bytes = bytes(content)
    
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1].lower()
        
        # Allowlist of safe extensions
        ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp3', '.wav', '.ogg', '.webm', '.mp4', '.pdf', '.txt', '.doc', '.docx'}
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File extension {ext} not allowed.")
            
        unique_filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        with open(file_path, "wb") as f:
            f.write(content_bytes)

        return {"url": f"/uploads/{unique_filename}", "filename": file.filename}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload error: {str(e)}")
