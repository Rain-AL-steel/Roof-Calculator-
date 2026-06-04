import { afterEach, describe, expect, it } from "vitest";
import {
  geocodeDeliveryAddress,
  isAllowedGeocodeResult,
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

function makeGeocode(city, overrides) {
  var cityCode = city === "\u8386\u7530" ? "350300" : (city === "\u6cc9\u5dde" ? "350500" : "350400");
  return Object.assign({
    location: { lng: 119.01, lat: 25.45 },
    formattedAddress: "\u798f\u5efa\u7701" + city + "\u5e02\u6d4b\u8bd5\u5730\u5740",
    province: "\u798f\u5efa\u7701",
    city: city + "\u5e02",
    district: "",
    adcode: cityCode,
    addressComponent: {
      province: "\u798f\u5efa\u7701",
      city: city + "\u5e02",
      district: "",
      adcode: cityCode
    }
  }, overrides || {});
}

function installFakeAmapLoaderWithGeocodes(getGeocodes) {
  var calls = [];
  Object.defineProperty(globalThis, "AMapLoader", {
    configurable: true,
    value: {
      load: function () {
        return Promise.resolve({
          Geocoder: function FakeGeocoder(options) {
            var city = options && options.city ? options.city : "";
            this.getLocation = function (address, callback) {
              calls.push({ city: city, address: address });
              var geocodes = getGeocodes(city, address);
              callback("complete", {
                info: "OK",
                geocodes: Array.isArray(geocodes) ? geocodes : []
              });
            };
          }
        });
      }
    }
  });
  return calls;
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

  it("accepts allowed city information from top-level and addressComponent fields", function () {
    expect(isAllowedGeocodeResult(makeGeocode("\u6cc9\u5dde"))).toBe(true);
    expect(isAllowedGeocodeResult(makeGeocode("\u8386\u7530", { city: "", adcode: "", formattedAddress: "" }))).toBe(true);
    expect(isAllowedGeocodeResult(makeGeocode("\u4e09\u660e"))).toBe(false);
  });

  it("uses Putian first for Putian addresses", async function () {
    var calls = installFakeAmapLoaderWithGeocodes(function (city) {
      return city === "\u8386\u7530" ? [makeGeocode("\u8386\u7530")] : [];
    });

    var location = await geocodeDeliveryAddress("\u798f\u5efa\u7701\u8386\u7530\u5e02\u79c0\u5c7f\u533a", makeConfig("\u6cc9\u5dde\u5e02"));

    expect(calls.map(function (call) { return call.city; })).toEqual(["\u8386\u7530"]);
    expect(location.city).toBe("\u8386\u7530\u5e02");
  });

  it("uses Quanzhou first for Quanzhou addresses", async function () {
    var calls = installFakeAmapLoaderWithGeocodes(function (city) {
      return city === "\u6cc9\u5dde" ? [makeGeocode("\u6cc9\u5dde")] : [];
    });

    var location = await geocodeDeliveryAddress("\u798f\u5efa\u7701\u6cc9\u5dde\u5e02\u60e0\u5b89\u53bf", makeConfig("\u8386\u7530\u5e02"));

    expect(calls.map(function (call) { return call.city; })).toEqual(["\u6cc9\u5dde"]);
    expect(location.city).toBe("\u6cc9\u5dde\u5e02");
  });

  it("defaults unclear addresses to Quanzhou and scopes the query text", async function () {
    var calls = installFakeAmapLoaderWithGeocodes(function (city) {
      return city === "\u6cc9\u5dde" ? [makeGeocode("\u6cc9\u5dde")] : [];
    });

    var location = await geocodeDeliveryAddress("\u4e0a\u7530", makeConfig(""));

    expect(calls[0]).toEqual({ city: "\u6cc9\u5dde", address: "\u6cc9\u5dde\u5e02 \u4e0a\u7530" });
    expect(location.address).toBe("\u4e0a\u7530");
    expect(location.city).toBe("\u6cc9\u5dde\u5e02");
  });

  it("rejects Sanming results before trying the other business city", async function () {
    var calls = installFakeAmapLoaderWithGeocodes(function (city) {
      if (city === "\u6cc9\u5dde") return [makeGeocode("\u4e09\u660e")];
      return [makeGeocode("\u8386\u7530")];
    });

    var location = await geocodeDeliveryAddress("\u4e0a\u7530", makeConfig("\u6cc9\u5dde\u5e02"));

    expect(calls.map(function (call) { return call.city; })).toEqual(["\u6cc9\u5dde", "\u8386\u7530"]);
    expect(location.city).toBe("\u8386\u7530\u5e02");
  });

  it("fails when fallback results are still outside Quanzhou and Putian", async function () {
    var calls = installFakeAmapLoaderWithGeocodes(function (city) {
      return city === "\u6cc9\u5dde" ? [makeGeocode("\u4e09\u660e")] : [makeGeocode("\u798f\u5dde", { adcode: "350100" })];
    });

    await expect(geocodeDeliveryAddress("\u4e0a\u7530", makeConfig("\u6cc9\u5dde\u5e02"))).rejects.toThrow();
    expect(calls.map(function (call) { return call.city; })).toEqual(["\u6cc9\u5dde", "\u8386\u7530"]);
  });
});
