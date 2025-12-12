from pydantic import BaseModel, HttpUrl
from typing import Optional


class LineLoginStartResponse(BaseModel):
    auth_url: HttpUrl
    state: str
    session_id: Optional[str] = None


class LineCallbackRequest(BaseModel):
    code: str
    state: str
    redirect_uri: Optional[str] = None
