(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  function getCurrentScript() {
    return (
      document.currentScript ||
      document.querySelector('script[data-support-agent][data-widget-init!="true"]')
    );
  }

  function normalizeBase(base, fallbackUrl) {
    var value = (base || "").trim();
    if (!value && fallbackUrl) {
      try {
        return new URL(fallbackUrl, window.location.href).origin.replace(/\/+$/, "");
      } catch (_error) {}
    }
    if (!value) return window.location.origin;
    return value.replace(/\/+$/, "");
  }

  function createStyles() {
    if (document.getElementById("vx-support-widget-styles")) return;

    var style = document.createElement("style");
    style.id = "vx-support-widget-styles";
    style.textContent = [
      ".vx-support-widget-root{position:fixed;right:8px;bottom:24px;z-index:2147483000;font-family:Arial,sans-serif}",
      ".vx-support-widget-panel{position:fixed;right:8px;bottom:96px;width:min(380px,calc(100vw - 20px));height:min(680px,calc(100vh - 120px));background:#fff;border:1px solid rgba(15,23,42,.12);border-radius:20px;box-shadow:0 24px 80px rgba(15,23,42,.2);overflow:hidden;opacity:0;pointer-events:none;transform:translateY(8px) scale(.98);transition:opacity .18s ease,transform .18s ease}",
      ".vx-support-widget-root[data-open='true'] .vx-support-widget-panel{opacity:1;pointer-events:auto;transform:translateY(0) scale(1)}",
      ".vx-support-widget-frame{width:100%;height:100%;border:0;background:#fff}",
      ".vx-support-widget-button{display:flex;align-items:center;gap:10px;border:0;border-radius:999px;padding:14px 18px;background:#111827;color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 12px 30px rgba(17,24,39,.28)}",
      ".vx-support-widget-button-icon-only{width:56px;height:56px;justify-content:center;padding:0}",
      ".vx-support-widget-button:hover{filter:brightness(1.05)}",
      ".vx-support-widget-dot{width:10px;height:10px;border-radius:999px;background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.18)}",
      ".vx-support-widget-avatar{width:28px;height:28px;border-radius:999px;object-fit:cover;border:2px solid rgba(255,255,255,.3);display:block}",
      "@media (max-width:640px){.vx-support-widget-root{right:6px;bottom:12px;left:6px}.vx-support-widget-panel{right:6px;left:6px;top:auto;bottom:80px;width:auto;height:min(75vh,680px)}.vx-support-widget-button{width:100%;justify-content:center}}",
    ].join("");
    document.head.appendChild(style);
  }

  function applyPosition(root, panel, position) {
    var p = position || "bottom-right";
    root.setAttribute("data-position", p);

    root.style.top = "";
    root.style.right = "";
    root.style.bottom = "";
    root.style.left = "";
    panel.style.top = "";
    panel.style.right = "";
    panel.style.bottom = "";
    panel.style.left = "";

    if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) {
      root.style.left = "6px";
      root.style.right = "6px";
      root.style.bottom = "12px";
      panel.style.left = "6px";
      panel.style.right = "6px";
      panel.style.bottom = "80px";
      return;
    }

    if (p === "bottom-left") {
      root.style.left = "8px";
      root.style.bottom = "24px";
      panel.style.left = "8px";
      panel.style.bottom = "96px";
      return;
    }
    if (p === "top-right") {
      root.style.right = "8px";
      root.style.top = "24px";
      panel.style.right = "8px";
      panel.style.top = "96px";
      return;
    }
    if (p === "top-left") {
      root.style.left = "8px";
      root.style.top = "24px";
      panel.style.left = "8px";
      panel.style.top = "96px";
      return;
    }

    root.style.right = "8px";
    root.style.bottom = "24px";
    panel.style.right = "8px";
    panel.style.bottom = "96px";
  }

  function resolveAvatarUrl(baseUrl, url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    return baseUrl + (url.startsWith("/") ? "" : "/") + url;
  }

  function getCacheKey(supportAgent) {
    return "vx-support-widget:" + supportAgent;
  }

  function readCachedBranding(supportAgent) {
    try {
      var raw = window.localStorage.getItem(getCacheKey(supportAgent));
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function writeCachedBranding(supportAgent, data) {
    try {
      window.localStorage.setItem(getCacheKey(supportAgent), JSON.stringify(data));
    } catch (_error) {}
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[<>&"]/g, "");
  }

  function renderTrigger(trigger, options) {
    var hasAvatar = !!options.avatarUrl;
    var label = options.label || "Chat with support";
    var display = options.display === "icon" ? "icon" : "label";
    trigger.classList.toggle("vx-support-widget-button-icon-only", display === "icon");
    trigger.innerHTML =
      (hasAvatar
        ? '<img src="' +
          escapeHtml(options.avatarUrl) +
          '" alt="" class="vx-support-widget-avatar" />'
        : '<span class="vx-support-widget-dot" aria-hidden="true"></span>') +
      (display === "icon"
        ? ""
        : '<span class="vx-support-widget-label">' + escapeHtml(label) + "</span>");
    trigger.setAttribute("aria-label", label);
    trigger.setAttribute("title", label);
  }

  function initWidget(script) {
    if (!script) return;
    script.setAttribute("data-widget-init", "true");

    var supportAgent = script.getAttribute("data-support-agent");
    if (!supportAgent) {
      console.error("[support-widget] Missing data-support-agent attribute.");
      return;
    }

    var baseUrl = normalizeBase(
      script.getAttribute("data-base-url") ||
        script.getAttribute("data-support-base-url") ||
        window.__VX_SUPPORT_WIDGET_BASE_URL__,
      script.src
    );
    var label = script.getAttribute("data-label") || "Chat with support";
    var labelOverridden = script.hasAttribute("data-label");
    var position = script.getAttribute("data-position") || "bottom-right";
    var display = script.getAttribute("data-display") || "label";
    var displayOverridden = script.hasAttribute("data-display");
    var widgetUrl = baseUrl + "/support/" + encodeURIComponent(supportAgent);
    var cachedBranding = readCachedBranding(supportAgent);

    createStyles();

    var root = document.createElement("div");
    root.className = "vx-support-widget-root";
    root.setAttribute("data-open", "false");

    var panel = document.createElement("div");
    panel.className = "vx-support-widget-panel";
    applyPosition(root, panel, position);

    var iframe = document.createElement("iframe");
    iframe.className = "vx-support-widget-frame";
    iframe.src = widgetUrl;
    iframe.title = "Support chat";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allow = "clipboard-write";

    var trigger = document.createElement("button");
    trigger.className = "vx-support-widget-button";
    trigger.type = "button";
    if (cachedBranding && cachedBranding.brandColor) {
      trigger.style.backgroundColor = cachedBranding.brandColor;
    }
    if (!labelOverridden && cachedBranding && (cachedBranding.widgetLabel || cachedBranding.name)) {
      label = cachedBranding.widgetLabel || cachedBranding.name;
    }
    if (!displayOverridden && cachedBranding && cachedBranding.widgetDisplay) {
      display = cachedBranding.widgetDisplay;
    }
    renderTrigger(trigger, { label: label, display: display, avatarUrl: "" });
    if (cachedBranding && cachedBranding.avatarUrl) {
      renderTrigger(trigger, {
        label: label,
        display: display,
        avatarUrl: resolveAvatarUrl(baseUrl, cachedBranding.avatarUrl),
      });
    }

    function setOpen(nextOpen) {
      root.setAttribute("data-open", nextOpen ? "true" : "false");
      trigger.setAttribute("aria-expanded", nextOpen ? "true" : "false");
    }

    trigger.addEventListener("click", function () {
      setOpen(root.getAttribute("data-open") !== "true");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });

    window.addEventListener("message", function (event) {
      if (!event.data || event.data.type !== "vx-support-agent-info") return;
      var data = event.data;
      if (data.brandColor) {
        trigger.style.backgroundColor = data.brandColor;
      }
      if (data.position) {
        applyPosition(root, panel, data.position);
      }
      if (!labelOverridden && (data.widgetLabel || data.name)) {
        label = data.widgetLabel || data.name;
      }
      if (!displayOverridden && data.widgetDisplay) {
        display = data.widgetDisplay;
      }
      writeCachedBranding(supportAgent, {
        brandColor: data.brandColor || trigger.style.backgroundColor || "",
        avatarUrl: data.avatarUrl || "",
        widgetLabel: data.widgetLabel || "",
        widgetDisplay: data.widgetDisplay || display,
        name: data.name || "",
      });
      renderTrigger(trigger, {
        label: label,
        display: display,
        avatarUrl: data.avatarUrl ? resolveAvatarUrl(baseUrl, data.avatarUrl) : "",
      });
    });

    panel.appendChild(iframe);
    root.appendChild(panel);
    root.appendChild(trigger);
    document.body.appendChild(root);
  }

  var script = getCurrentScript();
  if (script) {
    initWidget(script);
  } else {
    window.addEventListener("DOMContentLoaded", function () {
      initWidget(getCurrentScript());
    });
  }
})();
