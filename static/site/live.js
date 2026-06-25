/* Live chat client.
   - Username is kept in a browser cookie (and can be changed anytime).
   - Messages are polled from the server every few seconds.
   - No sign-in required. Message text is rendered with textContent so user
     input is never treated as HTML. */
(function () {
    "use strict";

    var COOKIE = "chat_username";
    var POLL_MS = 3000;
    var lastId = 0;
    var username = "";
    var polling = null;

    var elMessages = document.getElementById("chat-messages");
    var elName = document.getElementById("chat-name");
    var elChange = document.getElementById("chat-change");
    var form = document.getElementById("chat-form");
    var input = document.getElementById("chat-input");
    var sendBtn = document.getElementById("chat-send");

    var modal = document.getElementById("name-modal");
    var nameForm = document.getElementById("name-form");
    var nameInput = document.getElementById("name-input");

    if (!elMessages) return;

    // ---------- cookie helpers ----------
    function getCookie(name) {
        var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[1]) : "";
    }
    function setCookie(name, value, days) {
        var maxAge = days * 24 * 60 * 60;
        document.cookie =
            name + "=" + encodeURIComponent(value) + "; path=/; max-age=" + maxAge + "; SameSite=Lax";
    }

    // ---------- name handling ----------
    function applyName(name) {
        username = name.trim().slice(0, 40);
        elName.textContent = username;
        setCookie(COOKIE, username, 365);
    }

    function openNameModal() {
        nameInput.value = username || "";
        modal.hidden = false;
        setTimeout(function () {
            nameInput.focus();
        }, 50);
    }
    function closeNameModal() {
        modal.hidden = true;
    }

    nameForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var value = nameInput.value.trim();
        if (!value) {
            nameInput.focus();
            return;
        }
        applyName(value);
        closeNameModal();
        input.focus();
    });

    elChange.addEventListener("click", openNameModal);

    // ---------- rendering ----------
    function formatTime(iso) {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    function clearEmpty() {
        var empty = elMessages.querySelector(".chat-empty");
        if (empty) empty.remove();
    }

    function renderMessage(msg) {
        clearEmpty();
        var wrap = document.createElement("div");
        wrap.className = "msg" + (msg.username === username ? " mine" : "");

        var meta = document.createElement("div");
        meta.className = "msg-meta";
        var author = document.createElement("span");
        author.className = "msg-author";
        author.textContent = msg.username;
        meta.appendChild(author);
        meta.appendChild(document.createTextNode("  " + formatTime(msg.created_at)));

        var bubble = document.createElement("div");
        bubble.className = "msg-bubble";
        bubble.textContent = msg.body;

        wrap.appendChild(meta);
        wrap.appendChild(bubble);
        elMessages.appendChild(wrap);
    }

    function atBottom() {
        return elMessages.scrollHeight - elMessages.scrollTop - elMessages.clientHeight < 60;
    }
    function scrollToBottom() {
        elMessages.scrollTop = elMessages.scrollHeight;
    }

    function showEmpty() {
        if (elMessages.children.length === 0) {
            var p = document.createElement("div");
            p.className = "chat-empty";
            p.textContent = "No messages yet. Be the first to say hello!";
            elMessages.appendChild(p);
        }
    }

    // ---------- networking ----------
    function loadMessages() {
        var url = "/api/messages" + (lastId ? "?after=" + lastId : "");
        return fetch(url, { headers: { Accept: "application/json" } })
            .then(function (r) {
                return r.ok ? r.json() : [];
            })
            .then(function (list) {
                if (!Array.isArray(list) || list.length === 0) {
                    if (lastId === 0) showEmpty();
                    return;
                }
                var stick = atBottom();
                list.forEach(function (msg) {
                    renderMessage(msg);
                    if (msg.id > lastId) lastId = msg.id;
                });
                if (stick) scrollToBottom();
            })
            .catch(function () {
                /* ignore transient network errors; next poll retries */
            });
    }

    function sendMessage(body) {
        sendBtn.disabled = true;
        fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username, body: body }),
        })
            .then(function (r) {
                return r.ok ? r.json() : null;
            })
            .then(function (msg) {
                if (msg && msg.id) {
                    renderMessage(msg);
                    if (msg.id > lastId) lastId = msg.id;
                    scrollToBottom();
                }
            })
            .catch(function () {
                /* ignore; the message simply wasn't sent */
            })
            .then(function () {
                sendBtn.disabled = false;
                input.focus();
            });
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var body = input.value.trim();
        if (!body) return;
        if (!username) {
            openNameModal();
            return;
        }
        input.value = "";
        sendMessage(body);
    });

    function startPolling() {
        if (polling) return;
        polling = setInterval(loadMessages, POLL_MS);
    }
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            clearInterval(polling);
            polling = null;
        } else {
            loadMessages();
            startPolling();
        }
    });

    // ---------- boot ----------
    var saved = getCookie(COOKIE);
    if (saved) {
        applyName(saved);
    } else {
        openNameModal();
    }
    loadMessages().then(function () {
        scrollToBottom();
        showEmpty();
    });
    startPolling();
})();
