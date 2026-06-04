import { afterEach, describe, expect, it } from "vitest";
import {
  geocodeDeliveryAddress,
  resetAmapLoadCache,
  resolvePreferredGeocodeCities
} from "../src/scripts/services/amapService.js";

var originalAmapLoaderDescriptor = Object.getOwnPropertyDescriptor(globalThis, "AMapLoader");
var originalSecurityConfigDescriptor = Object.getOwnPropertyDescriptor(globalThis, "_AMapSecurityConfig");

function restoreGlobalProperty(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globalThis[name];
}

function makeConfig(geocodeCity) {
  return {
    mapSettings: {
      enabled: true,
      amapKey: "test",
      securityJsCode: "test",
      geocodeCity: geocodeCity || ""
    }
  };
}

function installFakeAmapLoader(resolveCity) {
  var requestedCities = [];
  Object.defineProperty(globalThis, "AMapLoader", {
    configurable: true,
    value: {
      load: function () {
        return Promise.resolve({
          Geocoder: function FakeGeocoder(options) {
            var city = options && options.city ? options.city : "";
            requestedCities.push(city);
            this.getLocation = function (address, callback) {
              if (city === resolveCity) {
                callback("complete", {
                  info: "OK",
                  geocodes: [{
                    location: { lng: 119.01, lat: 25.45 },
                    formattedAddress: address,
                    province: "\u798f\u5efa\u7701",
                    city: resolveCity + "\u5e02",
                    district: "",
                    adcode: resolveCity === "\u8386\u7530" ? "350300" : "350500"
                  }]
                });
                return;
              }
              callback("no_data", { info: "NO_DATA", geocodes: [] });
            };
          }
        });
      }
    }
  });
  return requestedCities;
}

afterEach(function () {
  resetAmapLoadCache();
  restoreGlobalProperty("AMapLoader", originalAmapLoaderDescriptor);
  restoreGlobalProperty("_AMapSecurityConfig", originalSecurityConfigDescriptor);
});

describe("amap service geocode city resolution", function () {
  it("prioritizes Putian and Quanzhou from the address before configured city", function () {
    expect(resolvePreferredGeocodeCities("\u798f\u5efa\u7701\u8386\u7530\u5e02\u79c0\u5c7f\u533a", "\u6cc9\u5dde\u5e02")).toEqual(["\u8386\u7530", "\u6cc9\u5dde"]);
    expect(resolvePreferredGeocodeCities("\u798f\u5efa\u7701\u6cc9\u5dde\u5e02\u60e0\u5b89\u53bf", "\u8386\u7530\u5e02")).toEqual(["\u6cc9\u5dde", "\u8386\u7530"]);
  });

  it("uses configured supported city for unclear addresses and defaults to Quanzhou", function () {
    expect(resolvePreferredGeocodeCities("\u6d1b\u9633\u9547\u5c7f\u5934\u6751", "\u8386\u7530\u5e02")).toEqual(["\u8386\u7530", "\u6cc9\u5dde"]);
    expect(resolvePreferredGeocodeCities("\u6d1b\u9633\u9547\u5c7f\u5934\u6751", "")).toEqual(["\u6cc9\u5dde", "\u8386\u7530"]);
  });

  it("falls back once between Quanzhou and Putian without using an empty city", async function () {
    var requestedCities = installFakeAmapLoader("\u8386\u7530");

    var location = await geocodeDeliveryAddress("\u6d1b\u9633\u9547\u5c7f\u5934\u6751", makeConfig("\u6cc9\u5dde\u5e02"));

    expect(requestedCities).toEqual(["\u6cc9\u5dde", "\u8386\u7530"]);
    expect(requestedCities.every(Boolean)).toBe(true);
    expect(location.city).toBe("\u8386\u7530\u5e02");
  });
});
