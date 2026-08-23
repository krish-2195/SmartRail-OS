from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password
from app.models.user import User


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def register(
        self,
        email: str,
        full_name: str,
        password: str,
        role: str = "passenger",
        user_id_code: str | None = None,
        station_id: str | None = None,
    ) -> User:
        clean_email = email.strip().lower()
        clean_code = user_id_code.strip() if user_id_code else None

        # Prevent duplicate users by email
        existing_email = await self.db.execute(select(User).where(User.email == clean_email))
        if existing_email.scalar_one_or_none() is not None:
            raise ValueError("User with this email already exists")

        # Prevent duplicate users by user_id_code if provided
        if clean_code:
            existing_code = await self.db.execute(select(User).where(User.user_id_code == clean_code))
            if existing_code.scalar_one_or_none() is not None:
                raise ValueError(f"User with ID '{clean_code}' already exists")

        user = User(
            user_id_code=clean_code,
            email=clean_email,
            full_name=full_name.strip(),
            hashed_password=hash_password(password),
            role=role.strip().lower(),
            station_id=station_id.strip().upper() if station_id else None,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def login(self, identifier: str, password: str) -> tuple[str, str, User]:
        clean_id = identifier.strip()
        # Search by email or user_id_code
        query = select(User).where(
            or_(
                User.email == clean_id.lower(),
                User.user_id_code == clean_id,
                User.user_id_code == clean_id.upper(),
            )
        )
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()

        if user is None or not verify_password(password, user.hashed_password):
            raise ValueError("Invalid credentials")

        if not user.is_active:
            raise ValueError("Account is deactivated. Please contact administrator.")

        extra_claims = {
            "user_id_code": user.user_id_code,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "station_id": user.station_id,
        }

        access_token = create_access_token(str(user.id), extra_claims=extra_claims)
        refresh_token = create_refresh_token(str(user.id))
        return access_token, refresh_token, user