import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { TestDefinitionSchema } from "../../src/app/models/tenant/TestDefinition.js";
import { seedDefaultTests } from "../../src/app/lib/test-seeder.js";

test("TestDefinition parameter unit schema validation", async () => {
  const TestDefinition =
    mongoose.models.TestDefinitionUnitTest ||
    mongoose.model("TestDefinitionUnitTest", TestDefinitionSchema);

  // Test valid units
  const validUnits = ["mg/dL", "g/dL", "%", "cells/µL", "mmol/L", "U/L", "ratio", "titre", "-"];
  for (const unit of validUnits) {
    const testDoc = new TestDefinition({
      name: "Hemoglobin",
      category: new mongoose.Types.ObjectId(),
      sampleType: "Whole Blood",
      price: 100,
      parameters: [{ name: "Hb", unit }]
    });
    await assert.doesNotReject(() => testDoc.validate(), `Should accept unit: ${unit}`);
  }

  // Test invalid units (URLs or invalid characters)
  const invalidUnits = ["http://google.com", "www.example.com", "unit<script>"];
  for (const unit of invalidUnits) {
    const testDoc = new TestDefinition({
      name: "Hemoglobin",
      category: new mongoose.Types.ObjectId(),
      sampleType: "Whole Blood",
      price: 100,
      parameters: [{ name: "Hb", unit }]
    });
    await assert.rejects(() => testDoc.validate(), `Should reject unit: ${unit}`);
  }
});

test("test-seeder.js default export and data structure", () => {
  assert.equal(typeof seedDefaultTests, "function", "seedDefaultTests should be a function");
});
