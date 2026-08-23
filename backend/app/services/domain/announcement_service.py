import logging
import uuid
from typing import List
from datetime import datetime

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.base import AnnouncementRepository
from app.schemas.rail import AnnouncementOut, AnnouncementCreate
from app.models.announcement import Announcement
from app.core.websockets import manager

logger = logging.getLogger(__name__)

class AnnouncementService:
    def __init__(self, db: AsyncSession, announcement_repo: AnnouncementRepository):
        self.db = db
        self.announcement_repo = announcement_repo

    async def get_active_announcements(self) -> List[AnnouncementOut]:
        """Fetch all active announcements."""
        announcements = await self.announcement_repo.get_active()
        return [
            AnnouncementOut(
                id=a.id,
                text=a.text,
                context=a.context_info,
                is_active=a.is_active,
                created_at=a.created_at
            ) for a in announcements
        ]

    async def broadcast_announcement(self, create_data: AnnouncementCreate) -> AnnouncementOut:
        """Create a new active announcement and broadcast via WebSocket."""
        announcement_id = f"ann-{uuid.uuid4().hex[:8]}"
        from app.core.sim_clock import sim_clock
        announcement = Announcement(
            id=announcement_id,
            text=create_data.text,
            context_info=create_data.context_info,
            is_active=True,
            created_at=sim_clock.now()
        )
        
        await self.announcement_repo.create(announcement)
        await self.db.commit()
        
        logger.info(f"BROADCAST INITIATED: {announcement.text}")
        logger.info(f"PUSH NOTIFICATION DISPATCHED to passenger app for announcement {announcement_id}")

        # Broadcast in real-time to all connected WebSocket clients
        await manager.broadcast({
            "event_type": "announcement_broadcast",
            "data": {
                "id": announcement.id,
                "text": announcement.text,
                "context": announcement.context_info,
                "is_active": announcement.is_active,
                "created_at": announcement.created_at.isoformat()
            }
        })

        return AnnouncementOut(
            id=announcement.id,
            text=announcement.text,
            context=announcement.context_info,
            is_active=announcement.is_active,
            created_at=announcement.created_at
        )

    async def deactivate_announcement(self, announcement_id: str) -> bool:
        """Deactivate an active announcement."""
        return await self.announcement_repo.deactivate(announcement_id)

async def get_announcement_service(db: AsyncSession = Depends(get_db)) -> AnnouncementService:
    return AnnouncementService(db, AnnouncementRepository(db))
