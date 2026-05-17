import "dotenv/config";
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Health Check", () => {
  it("should return 200 OK", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "OK");
    expect(response.body).toHaveProperty("timestamp");
  });
});
