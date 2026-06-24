"""Basic smoke tests for the Flask blog using an in-memory database."""

import os
import unittest

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app import app, db, init_db  # noqa: E402
from seed import SAMPLE_POSTS  # noqa: E402


class BlogTestCase(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        with app.app_context():
            db.drop_all()
        init_db(seed=True)
        self.client = app.test_client()

    def test_index_lists_all_posts(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        body = response.get_data(as_text=True)
        for post in SAMPLE_POSTS:
            self.assertIn(post["title"], body)

    def test_post_detail_renders(self):
        response = self.client.get("/post/1/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(SAMPLE_POSTS[0]["category"], response.get_data(as_text=True))

    def test_missing_post_returns_404(self):
        response = self.client.get("/post/9999/")
        self.assertEqual(response.status_code, 404)

    def test_categories_present(self):
        body = self.client.get("/").get_data(as_text=True)
        for category in ("Watches", "Cycling", "Software", "Music"):
            self.assertIn(category, body)


if __name__ == "__main__":
    unittest.main()
