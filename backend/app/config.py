"""Environment-driven configuration. Secrets are read server-side only."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _root() -> Path:
    # backend/app/config.py -> repo root
    return Path(__file__).resolve().parents[2]


def _load_dotenv() -> None:
    env = _root() / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()


@dataclass
class Settings:
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_model_warning: str | None = None
    cors_allowed_origins: list[str] = field(default_factory=lambda: [
        o.strip() for o in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",") if o.strip()])
    solver_time_limit_seconds: float = field(default_factory=lambda: float(os.getenv("SOLVER_TIME_LIMIT_SECONDS", "2")))
    benchmark_runs_enabled: bool = field(default_factory=lambda: os.getenv("BENCHMARK_RUNS_ENABLED", "true").lower() == "true")
    max_request_bytes: int = 512 * 1024
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DOMINO_DATA_DIR", str(_root() / "data"))))
    benchmark_rate_per_minute: int = 6
    interpret_rate_per_minute: int = 12


import re  # noqa: E402

DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"


def normalize_model(value: str) -> tuple[str, str | None]:
    """A Gemini *model* name looks like ``gemini-…``. Anything else (e.g. a Google Cloud project id pasted by mistake)
    would fail on every call, so fall back to the default and say so instead of breaking silently."""
    v = (value or "").strip()
    if not v:
        return DEFAULT_GEMINI_MODEL, None
    if re.fullmatch(r"(models/)?gemini-[A-Za-z0-9._\-]+", v):
        return v, None
    return DEFAULT_GEMINI_MODEL, f"GEMINI_MODEL is not a Gemini model name; using {DEFAULT_GEMINI_MODEL}. Set it to e.g. {DEFAULT_GEMINI_MODEL}."


settings = Settings()
settings.gemini_model, settings.gemini_model_warning = normalize_model(os.getenv("GEMINI_MODEL", ""))
