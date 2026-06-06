const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {readFileSync} = require("fs");
const {resolve} = require("path");
const assert = require("assert");

const PROJECT_ID = "nomi-test-" + Date.now();
const RULES_PATH = resolve(__dirname, "../../firestore.rules");

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

// ── restaurants ──────────────────────────────────────────────────────

describe("restaurants", () => {
  it("unauthenticated user can read", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(db.collection("restaurants").doc("r1").get());
  });

  it("authenticated user cannot write", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
        db.collection("restaurants").doc("r1").set({name: "Test"}),
    );
  });
});

// ── users ────────────────────────────────────────────────────────────

describe("users", () => {
  it("user can read own document", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(db.collection("users").doc("user1").get());
  });

  it("user cannot read another user's document", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(db.collection("users").doc("user2").get());
  });

  it("unauthenticated cannot read any user document", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection("users").doc("user1").get());
  });
});

// ── rooms ────────────────────────────────────────────────────────────

describe("rooms", () => {
  it("authenticated user can read", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(db.collection("rooms").doc("room1").get());
  });

  it("unauthenticated cannot read", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection("rooms").doc("room1").get());
  });

  it("creator can update their own room", async () => {
    // Seed the room with createdBy = user1 via admin
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("rooms").doc("room1").set({
        createdBy: "user1",
        participants: ["user1"],
        status: "active",
      });
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(
        db.collection("rooms").doc("room1").update({status: "closed"}),
    );
  });

  it("non-creator cannot update", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("rooms").doc("room1").set({
        createdBy: "user1",
        participants: ["user1", "user2"],
        status: "active",
      });
    });

    const db = testEnv.authenticatedContext("user2").firestore();
    await assertFails(
        db.collection("rooms").doc("room1").update({status: "closed"}),
    );
  });
});

// ── votes ────────────────────────────────────────────────────────────

describe("votes", () => {
  it("authenticated user can create vote with matching user_id", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(
        db.collection("votes").doc("v1").set({
          room_id: "room1",
          user_id: "user1",
          restaurant_id: "r1",
          direction: true,
          timestamp: new Date(),
        }),
    );
  });

  it("user cannot create vote with another user's user_id", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
        db.collection("votes").doc("v2").set({
          room_id: "room1",
          user_id: "user2",
          restaurant_id: "r1",
          direction: true,
          timestamp: new Date(),
        }),
    );
  });

  it("authenticated user can read votes", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("votes").doc("v1").set({
        room_id: "room1",
        user_id: "user2",
        restaurant_id: "r1",
        direction: true,
        timestamp: new Date(),
      });
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(db.collection("votes").doc("v1").get());
  });

  it("nobody can update or delete a vote", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("votes").doc("v1").set({
        room_id: "room1",
        user_id: "user1",
        restaurant_id: "r1",
        direction: true,
        timestamp: new Date(),
      });
    });

    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
        db.collection("votes").doc("v1").update({direction: false}),
    );
    await assertFails(db.collection("votes").doc("v1").delete());
  });
});

// ── validation_votes ─────────────────────────────────────────────────

describe("validation_votes", () => {
  it("authenticated user can create", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(
        db.collection("validation_votes").doc("vv1").set({
          user_id: "user1",
          restaurant_id: "r1",
          tag: "cozy",
          direction: true,
          timestamp: new Date(),
        }),
    );
  });

  it("nobody can read", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("validation_votes").doc("vv1").set({
        user_id: "user1",
        restaurant_id: "r1",
        tag: "cozy",
        direction: true,
        timestamp: new Date(),
      });
    });

    // Not even the creator can read
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(db.collection("validation_votes").doc("vv1").get());

    // Unauthenticated also cannot read
    const unauth = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauth.collection("validation_votes").doc("vv1").get());
  });
});

// ── leaderboard ──────────────────────────────────────────────────────

describe("leaderboard", () => {
  it("unauthenticated user can read", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(db.collection("leaderboard").doc("user1").get());
  });

  it("nobody can write", async () => {
    const authDb = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
        authDb.collection("leaderboard").doc("user1").set({
          display_name: "Hacker",
          points: 9999,
        }),
    );

    const unauth = testEnv.unauthenticatedContext().firestore();
    await assertFails(
        unauth.collection("leaderboard").doc("user1").set({
          display_name: "Hacker",
          points: 9999,
        }),
    );
  });
});
