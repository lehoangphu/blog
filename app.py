"""Personal website for Phu & Peter Le — Vietnamese Bamboo Flute & Piano Duo.

A small Flask app that serves the single-page site. Designed for Python 3.14
and Azure App Service (Linux) behind Gunicorn; the WSGI entry point is the
module-level ``app`` object, so ``gunicorn app:app`` works with no extra config.
"""

from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html", active="home")


@app.route("/math")
def math():
    return render_template("math.html", active="math")


if __name__ == "__main__":
    app.run(debug=True)
