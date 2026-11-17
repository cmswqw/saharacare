import test from "node:test";
import assert from "node:assert/strict";
import { eligiblePromotions, nextPromotion, readRotation, writeRotation } from "../lib/promotions/policy";
import { loadServerModule } from "./server-module";
const item = { id: "a", hospitalName: "DEMO fictional", imageUrl: "/promotions/demo.svg", destinationUrl: "https://example.invalid", isActive: true, priority: 1 };
test("production samples require explicit production-demo permission as well as the demo flag", () => {
  const cases: [Record<string, string>, number][] = [
    [{ NODE_ENV: "production", HOSPITAL_PROMOTIONS_DEMO: "true" }, 0],
    [{ NODE_ENV: "production", HOSPITAL_PROMOTIONS_ALLOW_PRODUCTION_DEMO: "true" }, 0],
    [{ NODE_ENV: "production", HOSPITAL_PROMOTIONS_DEMO: "true", HOSPITAL_PROMOTIONS_ALLOW_PRODUCTION_DEMO: "true" }, 3],
    [{ NODE_ENV: "development", HOSPITAL_PROMOTIONS_DEMO: "true" }, 3], [{ NODE_ENV: "development" }, 0],
  ];
  for (const [environment, expected] of cases) {
    const module = loadServerModule("lib/promotions/config.ts", {}, environment);
    assert.equal((module.getHospitalPromotions as () => unknown[])().length, expected);
  }
});
test("promotion records fail closed on unsafe URLs, invalid content and duplicate IDs", () => {
  for (const destinationUrl of ["javascript:alert(1)", "data:text/plain,a", "file:///a", "http://example.invalid", "https://user:pass@example.invalid", "", null]) assert.deepEqual(eligiblePromotions([{ ...item, destinationUrl }]), []);
  for (const override of [{ isActive: false }, { imageUrl: "//tracker.invalid/a" }, { imageUrl: "/promotions/../private" }, { priority: NaN }, { hospitalName: "" }]) assert.deepEqual(eligiblePromotions([{ ...item, ...override }]), []);
  assert.equal(eligiblePromotions([item, item]).length, 1);
  assert.deepEqual(eligiblePromotions(null), []);
});
test("priority orders rotation but never monopolizes display; removal/addition is stable", () => {
  const list = eligiblePromotions([{ ...item, id: "c", priority: 0 }, { ...item, id: "b" }, item]);
  assert.deepEqual(list.map(p => p.id), ["a", "b", "c"]);
  assert.equal(nextPromotion(list, null)?.id, "a"); assert.equal(nextPromotion(list, "a")?.id, "b");
  assert.equal(nextPromotion(list, "c")?.id, "a"); assert.equal(nextPromotion(list, "removed")?.id, "a");
  assert.equal(nextPromotion([], "a"), null);
});
test("rotation tolerates blocked/corrupt storage and writes only through explicit presentation callback", () => {
  assert.equal(readRotation({ getItem() { throw Error(); } }), null);
  assert.equal(readRotation({ getItem: () => "{bad" }), null);
  assert.equal(readRotation({ getItem: () => '{"id":"a"}' }), null);
  assert.equal(readRotation({ getItem: () => '"a"' }), "a");
  assert.doesNotThrow(() => writeRotation({ setItem() { throw Error(); } }, "a"));
});
