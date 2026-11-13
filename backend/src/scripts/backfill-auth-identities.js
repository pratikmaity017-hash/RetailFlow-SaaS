import mongoose from "mongoose";

import connectDB from "../config/database.js";
import User from "../models/user.model.js";
import AuthIdentity from "../models/auth-identity.model.js";

const EXECUTE = process.argv.includes("--execute");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function getId(value) {
  return String(value);
}

function isValidPasswordHash(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sameDate(first, second) {
  if (!first && !second) return true;
  if (!first || !second) return false;

  return new Date(first).getTime() === new Date(second).getTime();
}

function matchesExistingIdentity(user, identity, normalizedEmail) {
  return (
    getId(identity.user) === getId(user._id) &&
    identity.provider === "email" &&
    identity.providerSubject === normalizedEmail &&
    identity.email === normalizedEmail &&
    identity.passwordHash === user.passwordHash &&
    identity.status === user.status &&
    sameDate(identity.verifiedAt, user.emailVerifiedAt)
  );
}

async function hasRequiredUniqueIndex() {
  try {
    const indexes = await AuthIdentity.collection.indexes();

    return indexes.some((index) => {
      const keys = Object.entries(index.key || {});

      return (
        index.unique === true &&
        keys.length === 2 &&
        keys[0][0] === "provider" &&
        keys[0][1] === 1 &&
        keys[1][0] === "providerSubject" &&
        keys[1][1] === 1
      );
    });
  } catch (error) {
    console.error("Could not inspect AuthIdentity indexes:", error.message);
    return false;
  }
}

async function buildBackfillPlan() {
  const users = await User.find({}).select("+passwordHash").lean();

  const identities = await AuthIdentity.find({
    provider: "email",
  })
    .select("+passwordHash")
    .lean();

  const identitiesByUser = new Map();
  const identitiesBySubject = new Map();

  for (const identity of identities) {
    const userId = getId(identity.user);

    if (!identitiesByUser.has(userId)) {
      identitiesByUser.set(userId, []);
    }

    identitiesByUser.get(userId).push(identity);

    const subject = normalizeEmail(identity.providerSubject);

    if (!identitiesBySubject.has(subject)) {
      identitiesBySubject.set(subject, []);
    }

    identitiesBySubject.get(subject).push(identity);
  }

  // Find duplicate normalized emails among existing users.
  const usersByEmail = new Map();

  for (const user of users) {
    const email = normalizeEmail(user.email);

    if (!usersByEmail.has(email)) {
      usersByEmail.set(email, []);
    }

    usersByEmail.get(email).push(user);
  }

  const duplicateEmails = new Set();

  for (const [email, matchingUsers] of usersByEmail) {
    if (email && matchingUsers.length > 1) {
      duplicateEmails.add(email);
    }
  }

  const plan = [];
  const report = {
    totalUsers: users.length,
    existingEmailIdentities: identities.length,
    alreadyCorrect: 0,
    missingIdentities: 0,
    conflicts: 0,
    issues: [],
  };

  function addIssue(user, reason) {
    report.conflicts++;

    report.issues.push({
      userId: getId(user._id),
      email: user.email || null,
      reason,
    });
  }

  for (const user of users) {
    const normalizedEmail = normalizeEmail(user.email);
    const userId = getId(user._id);

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      addIssue(user, "Missing or invalid email");
      continue;
    }

    if (duplicateEmails.has(normalizedEmail)) {
      addIssue(user, "Duplicate normalized email among users");
      continue;
    }

    if (!isValidPasswordHash(user.passwordHash)) {
      addIssue(user, "Missing password hash");
      continue;
    }

    if (!["active", "disabled"].includes(user.status)) {
      addIssue(user, "Invalid user status");
      continue;
    }

    const userIdentities = identitiesByUser.get(userId) || [];
    const subjectIdentities = identitiesBySubject.get(normalizedEmail) || [];

    if (userIdentities.length > 1) {
      addIssue(user, "Multiple email identities already belong to this user");
      continue;
    }

    if (userIdentities.length === 1) {
      const existing = userIdentities[0];

      if (matchesExistingIdentity(user, existing, normalizedEmail)) {
        report.alreadyCorrect++;
      } else {
        addIssue(user, "Existing email identity does not match User data");
      }

      continue;
    }

    if (subjectIdentities.length > 0) {
      addIssue(
        user,
        "Email identity with this provider subject already exists",
      );
      continue;
    }

    plan.push({
      userId: user._id,
      email: normalizedEmail,
      identity: {
        user: user._id,
        provider: "email",
        providerSubject: normalizedEmail,
        email: normalizedEmail,
        passwordHash: user.passwordHash,
        verifiedAt: user.emailVerifiedAt || null,
        status: user.status,
      },
    });
  }

  report.missingIdentities = plan.length;

  return { plan, report };
}

async function runBackfill() {
  console.log("\n======================================");
  console.log(" RetailFlow AuthIdentity Backfill");
  console.log("======================================\n");

  await connectDB();

  console.log("MongoDB connected.");

  const uniqueIndexExists = await hasRequiredUniqueIndex();

  const { plan, report } = await buildBackfillPlan();

  console.log("\n---------- BACKFILL REPORT ----------");

  console.log(`Total users: ${report.totalUsers}`);
  console.log(`Existing email identities: ${report.existingEmailIdentities}`);
  console.log(`Already correct: ${report.alreadyCorrect}`);
  console.log(`Missing identities: ${report.missingIdentities}`);
  console.log(`Conflicts: ${report.conflicts}`);
  console.log(
    `Required unique index exists: ${uniqueIndexExists ? "YES" : "NO"}`,
  );

  if (report.issues.length > 0) {
    console.log("\n---------- CONFLICT DETAILS ----------");

    for (const issue of report.issues.slice(0, 30)) {
      console.log({
        userId: issue.userId,
        email: issue.email,
        reason: issue.reason,
      });
    }

    if (report.issues.length > 30) {
      console.log(`...and ${report.issues.length - 30} more conflicts.`);
    }
  }

  if (!EXECUTE) {
    console.log("\nDRY RUN COMPLETE.");
    console.log("No database records were created or modified.");
    console.log("Review this report before executing the migration.");
    return;
  }

  if (!uniqueIndexExists) {
    throw new Error(
      "Execution blocked: required unique provider identity index is missing.",
    );
  }

  if (report.conflicts > 0) {
    throw new Error(
      "Execution blocked: resolve reported conflicts before migration.",
    );
  }

  console.log("\nStarting approved backfill...");

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of plan) {
    try {
      // Recheck immediately before insertion.
      const existing = await AuthIdentity.findOne({
        provider: "email",
        providerSubject: item.email,
      }).lean();

      if (existing) {
        skipped++;
        console.log(`SKIPPED: ${item.email} (identity already exists)`);
        continue;
      }

      await AuthIdentity.create(item.identity);

      created++;
      console.log(`CREATED: ${item.email}`);
    } catch (error) {
      if (error.code === 11000) {
        skipped++;
        console.log(`SKIPPED: ${item.email} (duplicate-key conflict)`);
      } else {
        failed++;
        console.error(`FAILED: ${item.email}`, error.message);
      }
    }
  }

  console.log("\n---------- EXECUTION RESULT ----------");
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log("\nBackfill execution finished.");
}

runBackfill()
  .catch((error) => {
    console.error("\nBACKFILL ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  });
