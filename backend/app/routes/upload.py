from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from typing import Dict
import os
import uuid
import shutil
from ..auth import get_current_user
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

    # Read file size (by reading chunks until MAX_FILE_SIZE is reached)
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large. Max 5MB allowed.")
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    return {"url": f"/uploads/{unique_filename}", "filename": file.filename}
