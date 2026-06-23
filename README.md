# Phu's Blog

A personal blog built with [Django](https://www.djangoproject.com/) (the most
popular Python web framework) and **Python 3.14**. It ships with a post model,
a clean reading experience, the Django admin for writing posts, and a
ready-to-go Azure App Service deployment.

## Features

- 📝 Write and manage posts from the built-in Django admin (drafts + scheduled publishing)
- 🏠 Blog index listing published posts, with individual post pages
- 🎨 Lightweight, responsive styling (no frontend build step)
- ⚡ Static files served by [WhiteNoise](https://whitenoise.readthedocs.io/) — no separate CDN needed
- 🔒 Environment-driven, production-ready settings (`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, HTTPS hardening)
- ☁️ Deploys to Azure App Service via the included GitHub Actions workflow

## Tech stack

| Layer       | Choice                          |
| ----------- | ------------------------------- |
| Language    | Python 3.14                     |
| Framework   | Django 5.2 (LTS)                |
| Database    | SQLite (default)                |
| WSGI server | Gunicorn                        |
| Static      | WhiteNoise                      |
| Hosting     | Azure App Service               |

## Project structure

```
blog/            # Django project (settings, urls, wsgi/asgi)
posts/           # Blog app: models, views, admin, templates, static, migrations
manage.py        # Django management entry point
requirements.txt # Python dependencies
startup.sh       # Azure App Service startup command (migrate + gunicorn)
```

## Local development

Requires Python 3.11+ (3.14 in production).

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Apply migrations (also seeds a few sample posts)
python manage.py migrate

# 4. Create an admin user so you can write posts
python manage.py createsuperuser

# 5. Run the development server
python manage.py runserver
```

Then visit:

- http://127.0.0.1:8000/ — the blog
- http://127.0.0.1:8000/admin/ — write and manage posts

## Running tests

```bash
python manage.py test
```

## Configuration

Settings read from environment variables, so the same code runs locally and in
production:

| Variable                       | Default                          | Purpose                                  |
| ------------------------------ | -------------------------------- | ---------------------------------------- |
| `DJANGO_SECRET_KEY`            | insecure dev key                 | Cryptographic signing key (set in prod!) |
| `DJANGO_DEBUG`                 | `True`                           | Enable/disable debug mode                |
| `DJANGO_ALLOWED_HOSTS`         | `localhost,127.0.0.1`            | Comma-separated allowed hostnames        |
| `DJANGO_CSRF_TRUSTED_ORIGINS`  | _(empty)_                        | Comma-separated trusted origins          |
| `BLOG_TITLE`                   | `Phu's Blog`                     | Site title shown in the header           |
| `BLOG_TAGLINE`                 | `Thoughts on code, life, ...`    | Site tagline                             |
| `DJANGO_TIME_ZONE`             | `UTC`                            | Server time zone                         |

On Azure, `WEBSITE_HOSTNAME` is detected automatically and added to
`ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`.

## Deployment (Azure App Service)

Deployment is automated by `.github/workflows/main_phublog.yml`, which builds
and deploys to the `phublog` Web App on every push to `main`.

In the Azure portal, set these **Application settings** for the Web App:

- `DJANGO_SECRET_KEY` — a long, random value
- `DJANGO_DEBUG` — `False`
- `DJANGO_ALLOWED_HOSTS` — `phublog.azurewebsites.net` (and any custom domains)

And set the **Startup Command** to:

```
startup.sh
```

The build automatically runs `collectstatic`; `startup.sh` applies database
migrations and starts Gunicorn.
