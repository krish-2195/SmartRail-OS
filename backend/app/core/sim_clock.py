import os
from datetime import datetime, timedelta

class SimClock:
    def __init__(self):
        self._override_base: datetime | None = None
        self._set_at: datetime | None = None
        env_time = os.getenv("DEV_SIM_TIME")
        if env_time:
            try:
                self.set_time(env_time)
            except Exception:
                pass

    def now(self) -> datetime:
        if self._override_base is not None and self._set_at is not None:
            elapsed = datetime.now() - self._set_at
            return self._override_base + elapsed
        return datetime.now()

    def set_time(self, hhmm: str):
        """Set the simulation time using an HH:MM string and advance in real time."""
        try:
            parts = hhmm.strip().split(":")
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
            second = int(parts[2]) if len(parts) > 2 else 0
        except Exception as exc:
            raise ValueError("Invalid time format. Use HH:MM, e.g. 12:00") from exc
        
        now = datetime.now()
        self._override_base = datetime(now.year, now.month, now.day, hour, minute, second)
        self._set_at = now

    def reset(self):
        """Reset back to wall-clock time."""
        self._override_base = None
        self._set_at = None

    @property
    def is_overridden(self) -> bool:
        return self._override_base is not None

    @property
    def override_time(self) -> str | None:
        if self._override_base:
            return self._override_base.strftime("%H:%M")
        return None

sim_clock = SimClock()
