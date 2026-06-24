(function () {
  let openPdfViewer = null;
  const typoMap = [
    [/\bAcces Rapide\b/g, "Acc\u00e8s rapide"],
    [/\bRenovation\b/g, "R\u00e9novation"],
    [/\bcustomisation\b/g, "Customisation"],
    [/\bPIECES\b/g, "PI\u00c8CES"],
    [/\bpieces\b/g, "pi\u00e8ces"],
    [/\bbache\b/g, "b\u00e2che"],
    [/\barriere\b/g, "arri\u00e8re"],
    [/\bcarrosserie a l'aide d' un\b/g, "carrosserie \u00e0 l'aide d'un"],
    [/\bShemas\b/g, "Sch\u00e9mas"],
    [/\bdimmensions\b/g, "dimensions"],
    [/\belectrique\b/g, "\u00e9lectrique"],
    [/\bclebre\b/g, "c\u00e9l\u00e8bre"],
  ];

  function replaceTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      let text = node.nodeValue;
      let changed = false;
      for (const [pattern, replacement] of typoMap) {
        const next = text.replace(pattern, replacement);
        if (next !== text) {
          text = next;
          changed = true;
        }
      }
      if (changed) node.nodeValue = text;
    }
  }

  function enhanceImages() {
    const images = Array.from(document.querySelectorAll("img"));
    for (const img of images) {
      if (!img.hasAttribute("loading")) img.loading = "lazy";
      img.decoding = "async";
      img.style.cursor = "zoom-in";
      if (!img.alt) {
        const fallback = img.closest("a")?.textContent?.trim();
        if (fallback) img.alt = fallback.slice(0, 120);
      }
    }
  }

  function findPdfForImage(img) {
    const directAnchor = img.closest("a[href]");
    if (directAnchor) {
      const directHref = directAnchor.getAttribute("href") || "";
      if (/\.pdf($|[?#])/i.test(directHref)) return directAnchor.href || directHref;
    }

    const cell = img.closest("td, li, article, section, div");
    if (!cell) return "";
    const pdfAnchor = cell.querySelector('a[href*=".pdf"]');
    return pdfAnchor ? pdfAnchor.href : "";
  }

  function createLightbox() {
    const overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.innerHTML = `
      <div class="lightbox__panel" role="dialog" aria-modal="true" aria-label="Apercu de l'image">
        <button class="lightbox__close" type="button" aria-label="Fermer">&#xd7;</button>
        <img class="lightbox__image" alt="" />
        <div class="lightbox__caption"></div>
      </div>
    `;

    const imageEl = overlay.querySelector(".lightbox__image");
    const captionEl = overlay.querySelector(".lightbox__caption");
    const closeBtn = overlay.querySelector(".lightbox__close");

    const close = () => {
      overlay.classList.remove("is-open");
      document.body.style.overflow = "";
    };

    const open = (src, alt) => {
      imageEl.src = src;
      imageEl.alt = alt || "Apercu";
      captionEl.textContent = alt || "Cliquez en dehors ou sur x pour fermer";
      overlay.classList.add("is-open");
      document.body.style.overflow = "hidden";
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target === closeBtn) {
        close();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay.classList.contains("is-open")) close();
    });

    document.addEventListener(
      "click",
      (event) => {
        const img = event.target.closest && event.target.closest("img");
        if (!img || img.closest(".lightbox")) return;
        const pdfHref = findPdfForImage(img);
        if (pdfHref && openPdfViewer) {
          event.preventDefault();
          event.stopPropagation();
          openPdfViewer(resolvePdfHref(pdfHref, pdfHref), img.alt || img.title || "Document PDF");
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const src = img.currentSrc || img.src;
        if (src) open(src, img.alt || img.title || "");
      },
      true
    );

    document.body.appendChild(overlay);
    openPdfViewer = open;
  }

  function createPdfViewer() {
    const overlay = document.createElement("div");
    overlay.className = "pdf-viewer";
    overlay.innerHTML = `
      <div class="pdf-viewer__panel" role="dialog" aria-modal="true" aria-label="Lecteur PDF">
        <div class="pdf-viewer__header">
          <div class="pdf-viewer__title">Document PDF</div>
          <button class="lightbox__close" type="button" aria-label="Fermer">&#xd7;</button>
        </div>
        <iframe class="pdf-viewer__frame" title="Document PDF"></iframe>
        <div class="pdf-viewer__footer">
          <div class="pdf-viewer__hint">Le document s'ouvre directement dans le site.</div>
          <div class="pdf-viewer__actions">
            <a class="pdf-viewer__button pdf-viewer__open" href="#" target="_blank" rel="noopener">Ouvrir à part</a>
            <a class="pdf-viewer__button pdf-viewer__download" href="#" download>Télécharger</a>
          </div>
        </div>
      </div>
    `;

    const titleEl = overlay.querySelector(".pdf-viewer__title");
    const frameEl = overlay.querySelector(".pdf-viewer__frame");
    const openEl = overlay.querySelector(".pdf-viewer__open");
    const downloadEl = overlay.querySelector(".pdf-viewer__download");
    const closeBtn = overlay.querySelector(".lightbox__close");

    const close = () => {
      overlay.classList.remove("is-open");
      frameEl.src = "about:blank";
      document.body.style.overflow = "";
    };

    const open = (href, label) => {
      const url = href;
      titleEl.textContent = label || "Document PDF";
      frameEl.src = `${url}#toolbar=1&navpanes=0&view=FitH`;
      openEl.href = url;
      downloadEl.href = url;
      overlay.classList.add("is-open");
      document.body.style.overflow = "hidden";
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target === closeBtn) {
        close();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay.classList.contains("is-open")) close();
    });

    document.addEventListener(
      "click",
      (event) => {
        const anchor = event.target.closest && event.target.closest('a[href]');
        if (!anchor || anchor.closest(".lightbox") || anchor.closest(".pdf-viewer")) return;
        const href = anchor.getAttribute("href") || "";
        const isPdf = /\.pdf($|[?#])/i.test(href);
        if (!isPdf) return;
        event.preventDefault();
        event.stopPropagation();
        open(resolvePdfHref(href, anchor.href), anchor.textContent?.trim() || "Document PDF");
      },
      true
    );

    document.body.appendChild(overlay);
  }

  function resolvePdfHref(rawHref, resolvedHref) {
    const href = resolvedHref || rawHref;
    try {
      const url = new URL(href, location.href);
      if (url.hostname === "spideryan.free.fr") {
        return `${url.pathname.replace(/^\/+/, "")}${url.search}${url.hash}`;
      }
      if (url.protocol === "http:" || url.protocol === "https:") {
        return href;
      }
    } catch (_) {
      // fall through
    }
    return rawHref;
  }

  function createProgressBar() {
    const progress = document.createElement("div");
    progress.className = "page-progress";
    progress.innerHTML = '<span class="page-progress__bar"></span>';
    document.body.appendChild(progress);

    const bar = progress.querySelector(".page-progress__bar");
    const update = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, window.scrollY / max));
      bar.style.transform = `scaleX(${ratio})`;
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
  }

  function createBackToTop() {
    const btn = document.createElement("button");
    btn.className = "back-to-top";
    btn.type = "button";
    btn.setAttribute("aria-label", "Retour en haut");
    btn.textContent = "\u2191";
    document.body.appendChild(btn);

    const toggle = () => {
      btn.classList.toggle("is-visible", window.scrollY > 600);
    };

    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    toggle();
    window.addEventListener("scroll", toggle, { passive: true });
    window.addEventListener("resize", toggle, { passive: true });
  }

  function restoreScrollPosition() {
    const key = `scroll:${location.pathname}`;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const y = Number(saved);
      if (!Number.isNaN(y)) window.scrollTo(0, y);
    }
    window.addEventListener("beforeunload", () => {
      sessionStorage.setItem(key, String(window.scrollY));
    });
  }

  function restoreNormalBrowserActions() {
    document.oncontextmenu = null;
    document.onselectstart = null;
    document.onmousedown = null;
    document.onclick = null;
  }

  function init() {
    restoreNormalBrowserActions();
    replaceTextNodes(document.body);
    enhanceImages();
    createLightbox();
    createPdfViewer();
    createProgressBar();
    createBackToTop();
    restoreScrollPosition();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
