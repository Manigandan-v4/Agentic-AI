import { execFileSync } from "child_process";

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: "pipe"
  }).trim();
}

function normalizeFeatureName(featureName) {
  return String(featureName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export async function createFeatureBranch(featureName) {
  try {
    if (!featureName || !String(featureName).trim()) {
      throw new Error("Feature name is required.");
    }

    const safeFeatureName =
      normalizeFeatureName(featureName);

    if (!safeFeatureName) {
      throw new Error(
        "Unable to generate a valid feature branch name."
      );
    }

    const branchName =
      `feature/${safeFeatureName}`;

    // ----------------------------------------------------------
    // IMPORTANT:
    // Do NOT checkout main.
    // Do NOT pull.
    // Do NOT stash.
    // Do NOT reset.
    //
    // This allows the user's existing local changes to remain
    // exactly as they are.
    // ----------------------------------------------------------

    // Check whether the branch already exists locally.
    const localBranch =
      runGit([
        "branch",
        "--list",
        branchName
      ]);

    if (localBranch) {
      throw new Error(
        `Local branch already exists: ${branchName}`
      );
    }

    // Check whether the branch already exists remotely.
    const remoteBranch =
      runGit([
        "ls-remote",
        "--heads",
        "origin",
        branchName
      ]);

    if (remoteBranch) {
      throw new Error(
        `Remote branch already exists: ${branchName}`
      );
    }

    // Create branch from the current HEAD.
    runGit([
      "checkout",
      "-b",
      branchName
    ]);

    // Verify branch.
    const currentBranch =
      runGit([
        "branch",
        "--show-current"
      ]);

    if (currentBranch !== branchName) {
      throw new Error(
        `Branch verification failed. ` +
        `Expected: ${branchName}. ` +
        `Actual: ${currentBranch}.`
      );
    }

    return {
      success: true,
      branchName,

      content: [
        {
          type: "text",
          text:
            `✅ Feature branch created successfully.\n` +
            `Branch: ${branchName}`
        }
      ]
    };
  } catch (error) {
    return {
      success: false,

      content: [
        {
          type: "text",
          text:
            `❌ Feature branch creation failed.\n\n` +
            `${
              error instanceof Error
                ? error.message
                : String(error)
            }`
        }
      ]
    };
  }
}