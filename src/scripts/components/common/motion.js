var numberAnimationFrames = new WeakMap();
var transientTimers = new WeakMap();

export function shouldReduceMotion() {
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clearTransientTimer(element) {
  var timer = transientTimers.get(element);
  if (timer) window.clearTimeout(timer);
  transientTimers.delete(element);
}

export function restartMotionClass(element, className, duration) {
  if (!element || shouldReduceMotion()) return;
  clearTransientTimer(element);
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  var timer = window.setTimeout(function () {
    element.classList.remove(className);
    transientTimers.delete(element);
  }, Number(duration || 200));
  transientTimers.set(element, timer);
}

export function enterElement(element, className) {
  restartMotionClass(element, className || "motion-enter", 220);
}

export function pulseValue(element) {
  restartMotionClass(element, "motion-value-change", 240);
}

export function updateTextWithPulse(element, nextText) {
  if (!element) return false;
  var value = String(nextText);
  if (element.textContent === value) return false;
  element.textContent = value;
  pulseValue(element);
  return true;
}

export function animateNumberText(element, nextValue, formatter, options) {
  if (!element) return;
  var target = Number(nextValue);
  var format = typeof formatter === "function" ? formatter : function (value) { return String(value); };
  var settings = options || {};
  var duration = Number(settings.duration || 360);
  var existingFrame = numberAnimationFrames.get(element);
  if (existingFrame) window.cancelAnimationFrame(existingFrame);

  if (!Number.isFinite(target) || shouldReduceMotion() || typeof window.requestAnimationFrame !== "function") {
    element.textContent = format(target);
    element.dataset.motionValue = Number.isFinite(target) ? String(target) : "";
    return;
  }

  var previous = Number(element.dataset.motionValue);
  var configuredStart = Number(settings.startFrom);
  var startValue = Number.isFinite(previous) ? previous : (Number.isFinite(configuredStart) ? configuredStart : target);
  element.dataset.motionValue = String(target);
  if (startValue === target) {
    element.textContent = format(target);
    return;
  }

  var startTime = 0;
  function frame(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min(1, (timestamp - startTime) / duration);
    var eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = format(startValue + (target - startValue) * eased);
    if (progress < 1) {
      numberAnimationFrames.set(element, window.requestAnimationFrame(frame));
      return;
    }
    element.textContent = format(target);
    numberAnimationFrames.delete(element);
  }
  numberAnimationFrames.set(element, window.requestAnimationFrame(frame));
}

export function leaveAndRemove(element, onRemoved) {
  if (!element || element.dataset.motionLeaving === "true") return;
  var remove = typeof onRemoved === "function" ? onRemoved : function () { element.remove(); };
  element.dataset.motionLeaving = "true";
  if (shouldReduceMotion()) {
    remove();
    return;
  }
  element.classList.add("motion-leave");
  window.setTimeout(remove, 150);
}
