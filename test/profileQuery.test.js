import test from "node:test";
import assert from "node:assert/strict";
import { Op } from "sequelize";
import { buildListProfileQuery, buildSearchProfileQuery } from "../src/services/profileQueryService.js";
import { parseNaturalLanguageProfileQuery } from "../src/services/profileSearchService.js";

test("buildListProfileQuery builds combined filters and pagination", () => {
  const result = buildListProfileQuery({
    gender: "Female",
    age_group: "adult",
    country_id: "ng",
    min_age: "30",
    max_age: "45",
    min_gender_probability: "0.8",
    min_country_probability: "0.4",
    sort_by: "gender_probability",
    order: "asc",
    page: "2",
    limit: "5",
  });

  assert.equal(result.page, 2);
  assert.equal(result.limit, 5);
  assert.equal(result.offset, 5);
  assert.deepEqual(result.order, [["gender_probability", "ASC"], ["id", "ASC"]]);
  assert.equal(result.where.gender, "female");
  assert.equal(result.where.age_group, "adult");
  assert.equal(result.where.country_id, "NG");
  assert.equal(result.where.age[Op.gte], 30);
  assert.equal(result.where.age[Op.lte], 45);
  assert.equal(result.where.gender_probability[Op.gte], 0.8);
  assert.equal(result.where.country_probability[Op.gte], 0.4);
});

test("buildListProfileQuery rejects limits above 50", () => {
  assert.throws(
    () => buildListProfileQuery({ limit: "51" }),
    (error) => error.statusCode === 422 && error.message === "Invalid query parameters",
  );
});

test("parseNaturalLanguageProfileQuery handles documented examples", () => {
  assert.deepEqual(parseNaturalLanguageProfileQuery("young males"), {
    gender: "male",
    min_age: 16,
    max_age: 24,
  });

  assert.deepEqual(parseNaturalLanguageProfileQuery("females above 30"), {
    gender: "female",
    min_age: 30,
  });

  assert.deepEqual(parseNaturalLanguageProfileQuery("people from angola"), {
    country_id: "AO",
  });

  assert.deepEqual(parseNaturalLanguageProfileQuery("adult males from kenya"), {
    gender: "male",
    age_group: "adult",
    country_id: "KE",
  });

  assert.deepEqual(parseNaturalLanguageProfileQuery("male and female teenagers above 17"), {
    age_group: "teenager",
    min_age: 17,
  });
});

test("buildSearchProfileQuery applies parsed search filters with pagination defaults", () => {
  const result = buildSearchProfileQuery({ q: "adult males from kenya", order: "desc" });

  assert.equal(result.page, 1);
  assert.equal(result.limit, 10);
  assert.equal(result.where.gender, "male");
  assert.equal(result.where.age_group, "adult");
  assert.equal(result.where.country_id, "KE");
});