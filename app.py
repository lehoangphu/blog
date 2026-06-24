"""Personal blog web application built with Flask and SQLAlchemy.

Designed for Python 3.14 and deployment on Azure App Service (Linux) behind
Gunicorn. The WSGI entry point is the module-level ``app`` object, so Azure's
default startup command ``gunicorn app:app`` works with no extra configuration.
"""

import os
from datetime import date

from flask import Flask, abort, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import select

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__)

# On Azure App Service the app filesystem under /home is persisted, so the
# SQLite database survives restarts. Locally it lives next to this file.
default_db_path = os.path.join(BASE_DIR, "blog.db")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", f"sqlite:///{default_db_path}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["BLOG_TITLE"] = os.environ.get("BLOG_TITLE", "Phu's Blog")
app.config["BLOG_TAGLINE"] = os.environ.get(
    "BLOG_TAGLINE", "Watches, bikes, code, and the occasional bamboo flute."
)

db = SQLAlchemy(app)


class Post(db.Model):
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(80), nullable=False, default="General")

    def __repr__(self):
        return f"<Post {self.id}: {self.title!r}>"

    @property
    def paragraphs(self):
        """Split stored content into paragraphs for template rendering."""
        return [block.strip() for block in self.content.split("\n\n") if block.strip()]


@app.context_processor
def inject_blog_meta():
    return {
        "blog_title": app.config["BLOG_TITLE"],
        "blog_tagline": app.config["BLOG_TAGLINE"],
        "now_year": date.today().year,
    }


@app.route("/")
def index():
    posts = db.session.scalars(
        select(Post).order_by(Post.date.desc(), Post.id.desc())
    ).all()
    return render_template("index.html", posts=posts)


@app.route("/post/<int:post_id>/")
def post_detail(post_id):
    post = db.session.get(Post, post_id)
    if post is None:
        abort(404)
    return render_template("post.html", post=post)


@app.errorhandler(404)
def not_found(error):
    return render_template("404.html"), 404


def init_db(seed=True):
    """Create tables and, optionally, seed sample content when empty."""
    with app.app_context():
        db.create_all()
        if seed and db.session.scalar(select(db.func.count(Post.id))) == 0:
            from seed import seed_posts

            seed_posts()


# Ensure the database exists on first import so the app works out of the box on
# Azure (where Gunicorn imports this module directly).
init_db(seed=True)


if __name__ == "__main__":
    app.run(debug=True)
