"""Personal website for Phu & Peter Le — Vietnamese Bamboo Flute & Piano Duo.

A small Flask app that serves the single-page site. Designed for Python 3.14
and Azure App Service (Linux) behind Gunicorn; the WSGI entry point is the
module-level ``app`` object, so ``gunicorn app:app`` works with no extra config.
"""

from flask import Flask, jsonify, render_template, request

import db

app = Flask(__name__)
db.init_db()


@app.route("/")
def index():
    return render_template("index.html", active="home")


@app.route("/math")
def math():
    return render_template("math.html", active="math")


@app.route("/live")
def live():
    return render_template("live.html", active="live")


@app.route("/api/messages", methods=["GET"])
def api_get_messages():
    after = request.args.get("after", default=0, type=int)
    return jsonify(db.get_messages(after_id=after))


@app.route("/api/messages", methods=["POST"])
def api_post_message():
    data = request.get_json(silent=True) or {}
    try:
        message = db.add_message(data.get("username"), data.get("body"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(message), 201


if __name__ == "__main__":
    app.run(debug=True)
