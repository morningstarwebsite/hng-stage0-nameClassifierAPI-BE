import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyAgeGroup,
  transformProfileData,
  validateNameInput,
} from "../src/services/profileTransformService.js";

test("validateNameInput trims and collapses whitespace", () => {
  assert.equal(validateNameInput("  Mary   Jane  "), "Mary Jane");
});

test("classifyAgeGroup maps the expected ranges", () => {
  assert.equal(classifyAgeGroup(12), "child");
  assert.equal(classifyAgeGroup(19), "teenager");
  assert.equal(classifyAgeGroup(44), "adult");
  assert.equal(classifyAgeGroup(60), "senior");
});

test("transformProfileData keeps only transformed fields", () => {
  const profile = transformProfileData(
    "Amina",
    { gender: "female", probability: 0.99, count: 1250 },
    { age: 31 },
    {
      country: [
        { country_id: "ng", probability: 0.81 },
        { country_id: "gh", probability: 0.12 },
      ],
    },
  );

  assert.deepEqual(profile, {
    name: "Amina",
    normalized_name: "amina",
    gender: "female",
    probability: 0.99,
    sample_size: 1250,
    age: 31,
    age_group: "adult",
    country_id: "NG",
    country_probability: 0.81,
  });
});