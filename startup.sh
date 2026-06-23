#!/usr/bin/env bash
# Startup command for Azure App Service (Linux, Python).
# Set this as the "Startup Command" for the Web App: `startup.sh`
#
# Oryx runs `collectstatic` during the build, so here we only apply database
# migrations and then hand off to Gunicorn.
set -euo pipefail

python manage.py migrate --noinput

exec gunicorn blog.wsgi --bind=0.0.0.0:8000 --timeout 600 --workers 2
