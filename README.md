# Phu's Blog

A personal blog web application built with **Flask** and **SQLAlchemy**, written
for **Python 3.14** and optimized for deployment on **Azure App Service
(Linux)** behind Gunicorn.

## Features

- 🏠 Homepage listing all blog posts (newest first)
- 📄 Dynamic individual post pages (`/post/<id>/`)
- 🗂️ Posts stored in SQLite via SQLAlchemy (Title, Date, Content, Category)
- 🎨 Clean, responsive Jinja2 + CSS templates (no frontend build step)
- 🌱 Seed script that pre-populates starter content
- ☁️ GitHub Actions workflow that deploys to Azure using the publish-profile method

## Tech stack

| Layer       | Choice                       |
| ----------- | ---------------------------- |
| Language    | Python 3.14                  |
| Framework   | Flask 3                      |
| ORM         | Flask-SQLAlchemy / SQLAlchemy 2 |
| Database    | SQLite                       |
| WSGI server | Gunicorn                     |
| Hosting     | Azure App Service (Linux)    |

## Project structure

```
app.py             # Flask app: config, Post model, routes (homepage + post pages)
seed.py            # Script to (re)populate the database with starter posts
templates/         # Jinja2 templates (base, index, post, 404)
static/css/        # Responsive stylesheet
requirements.txt   # Flask, Flask-SQLAlchemy, SQLAlchemy, gunicorn
test_app.py        # Smoke tests (stdlib unittest)
.github/workflows/ # Azure deploy workflow (publish-profile method)
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

# 3. (Optional) Seed the database with the starter posts
python seed.py

# 4. Run the app
flask run
# or: python app.py
```

The app auto-creates the SQLite database and seeds it on first run, so visiting
http://127.0.0.1:5000/ just works.

## Running tests

```bash
python -m unittest test_app -v
```

## Configuration

| Variable       | Default                          | Purpose                          |
| -------------- | -------------------------------- | -------------------------------- |
| `DATABASE_URL` | `sqlite:///blog.db`              | SQLAlchemy database URL          |
| `BLOG_TITLE`   | `Phu's Blog`                     | Site title shown in the header   |
| `BLOG_TAGLINE` | `Watches, bikes, code, ...`      | Site tagline                     |

## Deployment (Azure App Service, Linux)

Deployment is automated by `.github/workflows/main_phublog.yml`, which builds
the Python 3.14 app and deploys to the `phublog` Web App on every push to
`main`. It authenticates to Azure using **OpenID Connect (OIDC)** federated
credentials.

### One-time setup

The following repo secrets must exist (already configured for this project):

- `AZUREAPPSERVICE_CLIENTID_…`
- `AZUREAPPSERVICE_TENANTID_…`
- `AZUREAPPSERVICE_SUBSCRIPTIONID_…`

These correspond to an Azure AD app registration with a federated credential
trusting this repo. (Recommended) Set the App Service **Startup Command** to:

```
gunicorn app:app
```

Azure's Oryx build also auto-detects `app:app`, so this is belt-and-braces.

Push to `main` and the workflow builds and deploys automatically.
