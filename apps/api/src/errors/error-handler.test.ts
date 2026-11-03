import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import {
  InputError,
  NotFoundError,
  UnauthorizedError,
} from "./application-errors.js";
import { registerApplicationErrorHandler } from "./error-handler.js";

const applications: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

function createApplication() {
  const application = Fastify();

  registerApplicationErrorHandler(application);
  applications.push(application);

  return application;
}

describe("application error handler", () => {
  it("returns controlled input errors as 400", async () => {
    const application = createApplication();
    application.get("/failure", async () => {
      throw new InputError("Invalid account name");
    });

    const response = await application.inject("/failure");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Invalid account name" });
  });

  it("returns authentication errors as 401", async () => {
    const application = createApplication();
    application.get("/failure", async () => {
      throw new UnauthorizedError();
    });

    const response = await application.inject("/failure");

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns missing resources as 404", async () => {
    const application = createApplication();
    application.get("/failure", async () => {
      throw new NotFoundError("Account not found");
    });

    const response = await application.inject("/failure");

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Account not found" });
  });

  it("preserves Fastify client errors", async () => {
    const application = createApplication();
    application.post("/json", async () => ({ accepted: true }));

    const response = await application.inject({
      method: "POST",
      url: "/json",
      headers: { "content-type": "application/json" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      statusCode: 400,
      code: "FST_ERR_CTP_EMPTY_JSON_BODY",
      error: "Bad Request",
      message: "Body cannot be empty when content-type is set to 'application/json'",
    });
  });

  it("hides unexpected errors behind a generic 500 response", async () => {
    const application = createApplication();
    application.get("/failure", async () => {
      throw new Error("Sensitive database failure");
    });

    const response = await application.inject("/failure");

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("Sensitive database failure");
  });
});
