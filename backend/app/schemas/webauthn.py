from pydantic import BaseModel
from typing import Any

class AuthenticatorAttestationResponseSchema(BaseModel):
    client_data_json: str
    attestation_object: str

class WebAuthnRegistrationCredential(BaseModel):
    id: str
    raw_id: str
    response: AuthenticatorAttestationResponseSchema
    type: str 