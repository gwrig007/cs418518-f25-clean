import request from "supertest";
import app from "../app.js";
import { pool } from "../database/connection.js";

const TEST_EMAIL = "testuser_" + Date.now() + "@example.com";
const TEST_PASSWORD = "Test1234!";

describe("Authentication Backend Tests", () => {

  // TC-01 SIGNUP
  test("TC-01 User can register an account", async () => {

    const res = await request(app)
      .post("/user/register")
      .send({
        firstName: "Test",
        lastName: "User",
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success || res.body.message).toBeTruthy();

  });

  // TC-02 LOGIN
  test("TC-02 User can log in with valid credentials", async () => {

    const res = await request(app)
      .post("/user/login")
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        recaptcha: "TEST_BYPASS"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message || res.body.success).toBeTruthy();

  });

  // TC-03 ADMIN ROLE CHECK
  test("TC-03 Verify user is NOT admin by default", async () => {

    const res = await request(app)
      .post("/advising/check-admin")
      .send({ email: TEST_EMAIL });

    expect(res.statusCode).toBe(200);
    expect(res.body.isAdmin).toBe(false);

  });

  // CLEANUP — DELETE TEST USER
  afterAll(async () => {

    await pool.query("DELETE FROM user_information WHERE u_email = ?", [TEST_EMAIL]);
    await pool.end();

  });

});
