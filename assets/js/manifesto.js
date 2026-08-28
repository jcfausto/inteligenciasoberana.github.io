function toggleSection(id) {
  const content = document.getElementById("content-" + id);
  const icon = document.getElementById("icon-" + id);

  if (!content || !icon) {
    return;
  }

  if (content.classList.contains("hidden")) {
    content.classList.remove("hidden");
    icon.textContent = "−";
    icon.classList.add("rotate-180");
  } else {
    content.classList.add("hidden");
    icon.textContent = "+";
    icon.classList.remove("rotate-180");
  }
}

const shareBodies = {
  pt: "A soberania digital começa com a soberania das mentes. O Brasil não pode virar somente uma fazenda de dados. Leia e apoie o manifesto Inteligência Soberana:",
  en: "Digital sovereignty begins with sovereign minds. Brazil cannot become only a data farm. Read and support the Inteligência Soberana manifesto:",
};

let shareCopyResetTimer;

function shareDialogEl() {
  return document.getElementById("shareDialog");
}

function shareTextEl() {
  return document.getElementById("shareText");
}

function fillShareText() {
  const dialog = shareDialogEl();
  const textarea = shareTextEl();
  if (!dialog || !textarea) {
    return;
  }
  const url = dialog.dataset.shareUrl || window.location.href;
  textarea.value = shareBodies[currentLang] + " " + url;
  textarea.setAttribute(
    "aria-label",
    currentLang === "en" ? "Share text" : "Texto para compartilhar"
  );
}

function resetShareCopyButton() {
  const btn = document.getElementById("shareCopyBtn");
  if (!btn) {
    return;
  }
  btn.innerHTML = '<span class="lang-pt">Copiar</span><span class="lang-en">Copy</span>';
}

function openShareDialog() {
  const dialog = shareDialogEl();
  if (!dialog || typeof dialog.showModal !== "function") {
    return;
  }
  fillShareText();
  resetShareCopyButton();
  dialog.showModal();
  const textarea = shareTextEl();
  if (textarea) {
    textarea.focus();
    textarea.select();
  }
}

function closeShareDialog() {
  const dialog = shareDialogEl();
  if (dialog && dialog.open) {
    dialog.close();
  }
}

function copyShareText() {
  const textarea = shareTextEl();
  const btn = document.getElementById("shareCopyBtn");
  if (!textarea || !btn) {
    return;
  }

  const text = textarea.value;
  const copiedLabels = {
    pt: "Copiado!",
    en: "Copied!",
  };

  const showCopied = () => {
    window.clearTimeout(shareCopyResetTimer);
    btn.textContent = copiedLabels[currentLang];
    shareCopyResetTimer = window.setTimeout(resetShareCopyButton, 1600);
  };

  const fallbackCopy = () => {
    textarea.removeAttribute("readonly");
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.setAttribute("readonly", "");
    return ok;
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showCopied).catch(() => {
      if (fallbackCopy()) {
        showCopied();
      }
    });
    return;
  }

  if (fallbackCopy()) {
    showCopied();
  }
}

function initShareDialog() {
  const dialog = shareDialogEl();
  if (!dialog) {
    return;
  }

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeShareDialog();
    }
  });
}

document.addEventListener("site-language-change", () => {
  const dialog = shareDialogEl();
  if (dialog && dialog.open) {
    fillShareText();
    resetShareCopyButton();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initShareDialog);
} else {
  initShareDialog();
}
