import { initAdminPage } from "./components/admin/adminPage.js";
import { initShippingPage } from "./components/shipping/shippingPage.js";
import { loadConfig, subscribeConfigChange } from "./services/configService.js";

var currentConfig = loadConfig();
var shippingView = document.getElementById("shippingView");
var adminView = document.getElementById("adminView");
var adminToggle = document.getElementById("adminToggle");
var backToShipping = document.getElementById("backToShipping");

function getConfig() {
  return currentConfig;
}

var shippingPage = initShippingPage({ getConfig: getConfig });
var adminPage = initAdminPage({ getConfig: getConfig });

function showShipping() {
  shippingView.hidden = false;
  adminView.hidden = true;
  shippingPage.recalc();
}

function showAdmin() {
  shippingView.hidden = true;
  adminView.hidden = false;
  adminPage.refreshFromConfig(currentConfig);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

adminToggle.addEventListener("click", showAdmin);
backToShipping.addEventListener("click", showShipping);

subscribeConfigChange(function (nextConfig) {
  currentConfig = nextConfig;
  shippingPage.applyConfig(currentConfig);
});
