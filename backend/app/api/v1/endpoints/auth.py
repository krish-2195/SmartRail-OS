from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, decode_token, get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserOut
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserOut:
    auth_service = AuthService(db)
    try:
        user = await auth_service.register(
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role=payload.role,
            user_id_code=payload.user_id_code,
            station_id=payload.station_id,
        )
        return UserOut(
            id=str(user.id),
            user_id_code=user.user_id_code,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            station_id=user.station_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    auth_service = AuthService(db)
    try:
        ident = payload.get_login_identifier()
        access_token, refresh_token, user = await auth_service.login(
            identifier=ident,
            password=payload.password,
        )
        user_out = UserOut(
            id=str(user.id),
            user_id_code=user.user_id_code,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            station_id=user.station_id,
        )
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=user_out,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Return currently authenticated user profile."""
    return UserOut(
        id=str(current_user.id),
        user_id_code=current_user.user_id_code,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        station_id=current_user.station_id,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        payload_data = decode_token(payload.refresh_token)
        if payload_data.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = payload_data.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid subject")

        from sqlalchemy import select
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")

        extra_claims = {
            "user_id_code": user.user_id_code,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "station_id": user.station_id,
        }
        new_access = create_access_token(str(user.id), extra_claims=extra_claims)
        user_out = UserOut(
            id=str(user.id),
            user_id_code=user.user_id_code,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            station_id=user.station_id,
        )
        return TokenResponse(
            access_token=new_access,
            refresh_token=payload.refresh_token,
            token_type="bearer",
            user=user_out,
        )
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


@router.post("/logout", response_model=dict[str, str])
async def logout(current_user: User = Depends(get_current_user)) -> dict[str, str]:
    """Client-side token invalidation confirmation."""
    return {"status": "success", "message": "Logged out successfully"}

