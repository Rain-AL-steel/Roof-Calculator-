var toastTimer = 0;
var confirmResolver = null;

function getToastRegion() {
  return document.getElementById("toastRegion");
}

export function showToast(message, type, options) {
  var region = getToastRegion();
  if (!region || !message) return;
  var settings = options || {};
  var toast = document.createElement("div");
  toast.className = "app-toast is-" + (type || "info");
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.innerHTML = "<strong>" + (type === "error" ? "操作失败" : type === "warning" ? "需要注意" : type === "success" ? "操作完成" : "系统提示") + "</strong><span></span>";
  toast.querySelector("span").textContent = String(message);
  region.replaceChildren(toast);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(function () {
    toast.classList.add("is-leaving");
    window.setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 180);
  }, Number(settings.duration || (type === "error" ? 6000 : 3800)));
}

function settleConfirm(value) {
  var dialog = document.getElementById("appConfirmDialog");
  if (dialog && dialog.open) dialog.close();
  if (!confirmResolver) return;
  var resolve = confirmResolver;
  confirmResolver = null;
  resolve(Boolean(value));
}

export function confirmAction(options) {
  var settings = typeof options === "string" ? { message: options } : (options || {});
  var dialog = document.getElementById("appConfirmDialog");
  if (!dialog || typeof dialog.showModal !== "function") {
    showToast("当前浏览器不支持安全确认框，请升级浏览器后重试。", "error");
    return Promise.resolve(false);
  }
  if (confirmResolver) settleConfirm(false);
  dialog.querySelector("[data-confirm-title]").textContent = settings.title || "确认操作";
  dialog.querySelector("[data-confirm-message]").textContent = settings.message || "确定继续吗？";
  var submit = dialog.querySelector("[data-confirm-submit]");
  submit.textContent = settings.confirmLabel || "确认";
  submit.classList.toggle("btn-danger", settings.danger !== false);
  submit.classList.toggle("btn-primary", settings.danger === false);
  dialog.showModal();
  return new Promise(function (resolve) {
    confirmResolver = resolve;
  });
}

export function initFeedback() {
  var dialog = document.getElementById("appConfirmDialog");
  if (!dialog || dialog.dataset.ready === "true") return;
  dialog.dataset.ready = "true";
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog || event.target.closest("[data-confirm-cancel]")) settleConfirm(false);
    if (event.target.closest("[data-confirm-submit]")) settleConfirm(true);
  });
  dialog.addEventListener("cancel", function (event) {
    event.preventDefault();
    settleConfirm(false);
  });
}
