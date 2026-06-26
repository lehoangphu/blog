"""Personal website for Phu & Peter Le — Vietnamese Bamboo Flute & Piano Duo.

A small Flask app that serves the single-page site. Designed for Python 3.14
and Azure App Service (Linux) behind Gunicorn; the WSGI entry point is the
module-level ``app`` object, so ``gunicorn app:app`` works with no extra config.

The chat/leaderboard database is stored on the persistent ``/home/data`` Azure
Files mount (see ``db.py``) so it survives deployments and restarts.
"""

from flask import Flask, jsonify, redirect, render_template, request

import db

app = Flask(__name__)
db.init_db()
db.purge_test_data()


@app.route("/")
def index():
    return render_template("index.html", active="home")


@app.route("/patrick")
def patrick():
    return render_template("math.html", active="math")


@app.route("/math")
def math():
    # Old path kept as a permanent redirect so existing links still work.
    return redirect("/patrick", code=301)


@app.route("/peter")
def peter():
    return render_template(
        "framed.html", active="peter", page_title="Peter", frame_src="/peter/home"
    )


@app.route("/peter/home")
def peter_home():
    return render_template("peter_home.html")


@app.route("/khanh")
def khanh():
    return render_template(
        "framed.html", active="khanh", page_title="Khanh", frame_src="/khanh/home"
    )


@app.route("/khanh/home")
def khanh_home():
    return render_template("khanh_home.html")


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


@app.route("/api/scores/<game>", methods=["GET"])
def api_get_scores(game):
    try:
        board = db.get_leaderboard(game)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify({"leaderboard": board})


@app.route("/api/scores/<game>/qualifies", methods=["GET"])
def api_score_qualifies(game):
    score = request.args.get("score", default=0, type=int)
    try:
        ok = db.qualifies(game, score)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    return jsonify({"qualifies": ok})


@app.route("/api/scores", methods=["POST"])
def api_post_score():
    data = request.get_json(silent=True) or {}
    try:
        result = db.add_score(
            data.get("game"), data.get("name"), data.get("score")
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(result), 201


if __name__ == "__main__":
    # Bind to 127.0.0.1:8080 for local preview (avoids default port 5000 conflicts).
    app.run(debug=True, host="127.0.0.1", port=8080)
