"""Render: gunicorn --config gunicorn.conf.py app:app (backend root directory)."""
import os

# Limit glibc memory arena fragmentation on Linux/Render
os.environ['MALLOC_ARENA_MAX'] = '2'
os.environ['WEB_CONCURRENCY'] = '1'

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"

# Render 512MB RAM optimization:
# Enforce single-worker multi-threaded architecture to prevent process memory duplication.
# 1 worker with 4 threads handles concurrent traffic comfortably under ~180MB RAM.
workers = 1
worker_class = 'gthread'
threads = int(os.environ.get('GUNICORN_THREADS', '4'))
timeout = 120
graceful_timeout = 30
keepalive = 5

# Auto-recycle worker after 500 requests to permanently prevent memory fragmentation/leaks
max_requests = 500

max_requests_jitter = 50

preload_app = False
accesslog = '-'
errorlog = '-'
