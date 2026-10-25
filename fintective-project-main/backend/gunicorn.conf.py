"""Render: gunicorn --config gunicorn.conf.py app:app (backend root directory)."""
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = max(1, int(os.environ.get('WEB_CONCURRENCY', '1')))
worker_class = 'gthread'
threads = max(2, int(os.environ.get('GUNICORN_THREADS', '4')))
timeout = 90
graceful_timeout = 30
keepalive = 5
preload_app = False
accesslog = '-'
errorlog = '-'
