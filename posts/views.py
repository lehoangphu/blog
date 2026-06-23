from django.shortcuts import get_object_or_404, render

from .models import Post


def post_list(request):
    posts = Post.objects.published().select_related("author")
    return render(request, "posts/post_list.html", {"posts": posts})


def post_detail(request, slug):
    post = get_object_or_404(
        Post.objects.published().select_related("author"),
        slug=slug,
    )
    return render(request, "posts/post_detail.html", {"post": post})
