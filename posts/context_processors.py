from django.conf import settings


def blog_info(request):
    return {
        "blog_title": getattr(settings, "BLOG_TITLE", "My Blog"),
        "blog_tagline": getattr(settings, "BLOG_TAGLINE", ""),
    }
