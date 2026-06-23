from django.db import migrations
from django.utils import timezone


SAMPLE_POSTS = [
    {
        "title": "Welcome to My Blog",
        "slug": "welcome-to-my-blog",
        "summary": "A quick hello and what you can expect to find here.",
        "body": (
            "Hi there, and welcome!\n\n"
            "This is my little corner of the internet where I write about "
            "software, the things I'm learning, and the occasional side quest.\n\n"
            "This site is built with Django and runs on Python 3.14. Thanks for "
            "stopping by \u2014 grab a coffee and stay a while."
        ),
    },
    {
        "title": "Why I Chose Django",
        "slug": "why-i-chose-django",
        "summary": "Batteries included, a great admin, and a community that just works.",
        "body": (
            "When it came time to build this blog, I reached for Django.\n\n"
            "It is the most popular full-stack Python web framework for good "
            "reason: the ORM, the built-in admin, migrations, and security "
            "defaults let me focus on writing instead of wiring.\n\n"
            "The admin alone means I can publish posts without building a custom "
            "CMS. That is a lot of value out of the box."
        ),
    },
    {
        "title": "Deploying to Azure App Service",
        "slug": "deploying-to-azure-app-service",
        "summary": "From git push to a live site with GitHub Actions.",
        "body": (
            "Shipping this blog is a single git push.\n\n"
            "A GitHub Actions workflow installs the dependencies, then Azure App "
            "Service serves the app with Gunicorn. WhiteNoise handles the static "
            "files, so there is no separate CDN to configure for a small site.\n\n"
            "It is a clean, low-maintenance setup \u2014 exactly what a personal "
            "blog should be."
        ),
    },
]


def create_sample_posts(apps, schema_editor):
    Post = apps.get_model("posts", "Post")
    now = timezone.now()
    for index, data in enumerate(SAMPLE_POSTS):
        Post.objects.update_or_create(
            slug=data["slug"],
            defaults={
                "title": data["title"],
                "summary": data["summary"],
                "body": data["body"],
                "status": "published",
                "published_at": now - timezone.timedelta(days=index),
            },
        )


def remove_sample_posts(apps, schema_editor):
    Post = apps.get_model("posts", "Post")
    Post.objects.filter(slug__in=[p["slug"] for p in SAMPLE_POSTS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_sample_posts, remove_sample_posts),
    ]
