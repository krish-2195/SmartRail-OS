from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    role: str = "passenger"
    user_id_code: str | None = None
    station_id: str | None = None


class LoginRequest(BaseModel):
    identifier: str | None = None
    email: str | None = None
    password: str

    def get_login_identifier(self) -> str:
        ident = self.identifier or self.email
        if not ident:
            raise ValueError("Email or User ID is required")
        return ident.strip()


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    user_id_code: str | None = None
    email: str
    full_name: str
    role: str
    station_id: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut | None = None

