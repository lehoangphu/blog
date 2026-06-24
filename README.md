# Phu & Peter Le — Vietnamese Bamboo Flute & Piano Duo

A personal website for **Phu & Peter Le**, a father-son duo performing
Vietnamese bamboo flute and piano. Built with **Flask** (Python 3.14) and
deployed on **Azure App Service (Linux)** behind Gunicorn.

## Tech stack

| Layer       | Choice                    |
| ----------- | ------------------------- |
| Language    | Python 3.14               |
| Framework   | Flask 3                   |
| WSGI server | Gunicorn                  |
| Hosting     | Azure App Service (Linux) |

## Project structure

```
app.py             # Flask app: serves the single-page site
templates/
  index.html       # The full page (hero, about, gallery, performances, store, hire, footer)
static/site/       # Compiled CSS and image assets for the page
requirements.txt   # Flask, gunicorn
.github/workflows/ # Azure deploy workflow (OIDC login)
```

## Local development

Requires Python 3.11+ (3.14 in production).

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt

flask run        # or: python app.py
```

Then visit http://127.0.0.1:5000/.

## Deployment (Azure App Service, Linux)

Deployment is automated by `.github/workflows/main_phublog.yml`, which builds
the Python 3.14 app and deploys to the `phublog` Web App on every push to
`main`, authenticating to Azure with **OpenID Connect (OIDC)** using these repo
secrets (already configured):

- `AZUREAPPSERVICE_CLIENTID_…`
- `AZUREAPPSERVICE_TENANTID_…`
- `AZUREAPPSERVICE_SUBSCRIPTIONID_…`

(Recommended) Set the App Service **Startup Command** to:

```
gunicorn app:app
```
