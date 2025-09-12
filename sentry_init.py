# sentry_init.py
import sentry_init  # важно: импорт ради побочного эффекта init
import os
import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN_BACKEND"),
    environment=os.getenv("APP_ENV", "development"),
    enable_tracing=True,
    traces_sample_rate=1.0 if os.getenv("APP_ENV") != "production" else 0.1,
    profiles_sample_rate=1.0 if os.getenv("APP_ENV") != "production" else 0.1,
    integrations=[LoggingIntegration(level=None, event_level="ERROR")],
    send_default_pii=False,  # не собираем PII по умолчанию
)