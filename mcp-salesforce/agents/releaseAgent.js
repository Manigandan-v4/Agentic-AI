import { getLastCommit } from "../tools/getLastCommit.js";
import { promoteToDev } from "../tools/promoteToDev.js";
import { promoteToProd } from "../tools/promoteToProd.js";
import { promoteToTest } from "../tools/promoteToTest.js";

/**
 * Extract text from an MCP-style result.
 */
function getResultText(result) {
  if (!result) {
    return "";
  }

  if (typeof result === "string") {
    return result;
  }

  if (Array.isArray(result?.content)) {
    return result.content
      .map((item) => item?.text || "")
      .filter(Boolean)
      .join("\n");
  }

  if (typeof result?.message === "string") {
    return result.message;
  }

  return "";
}

/**
 * Determine whether a tool result succeeded.
 */
function isSuccessful(result) {
  if (result === undefined || result === null) {
    return true;
  }

  if (typeof result?.success === "boolean") {
    return result.success;
  }

  if (typeof result?.ok === "boolean") {
    return result.ok;
  }

  if (Array.isArray(result?.content)) {
    const text = getResultText(result).toLowerCase();

    if (
      text.includes("failed") ||
      text.includes("error") ||
      text.includes("❌")
    ) {
      return false;
    }

    return true;
  }

  return true;
}

/**
 * Extract commit ID from the result returned by getLastCommit.
 *
 * Current implementation supports both:
 *
 * 1. Structured:
 *    { commitId: "abc123" }
 *
 * 2. MCP text:
 *    "abc123 ..."
 */
function extractCommitId(result) {
  if (!result) {
    return null;
  }

  if (
    typeof result.commitId === "string" &&
    result.commitId.trim()
  ) {
    return result.commitId.trim();
  }

  const text = getResultText(result).trim();

  if (!text) {
    return null;
  }

  // Supports a common format where the SHA is the first token.
  const firstToken = text.split(/\s+/)[0];

  // Git SHA can be full or abbreviated hexadecimal.
  if (/^[a-f0-9]{7,40}$/i.test(firstToken)) {
    return firstToken;
  }

  // Also support messages such as:
  // "Latest commit: abc123..."
  const match = text.match(/\b[a-f0-9]{7,40}\b/i);

  return match ? match[0] : null;
}

/**
 * Normalize environment input.
 */
function normalizeEnvironment(environment) {
  if (!environment) {
    throw new Error(
      "Environment is required. Use dev, test, or prod."
    );
  }

  const normalized = String(environment)
    .trim()
    .toLowerCase();

  const allowedEnvironments = new Set([
    "dev",
    "test",
    "prod"
  ]);

  if (!allowedEnvironments.has(normalized)) {
    throw new Error(
      `Invalid environment: ${environment}. ` +
        `Allowed values: dev, test, prod.`
    );
  }

  return normalized;
}

/**
 * Release Agent
 *
 * Workflow:
 * 1. Validate environment
 * 2. Get latest commit
 * 3. Validate commit
 * 4. Promote through GitHub Actions
 */
export async function releaseAgent(environment) {
  try {
    // ------------------------------------------------------------
    // 1. Validate environment
    // ------------------------------------------------------------
    const targetEnvironment =
      normalizeEnvironment(environment);

    // ------------------------------------------------------------
    // 2. Get latest commit
    // ------------------------------------------------------------
    const commitResult = await getLastCommit();

    if (!isSuccessful(commitResult)) {
      throw new Error(
        `Unable to retrieve latest commit. ${
          getResultText(commitResult) ||
          "No additional details."
        }`
      );
    }

    // ------------------------------------------------------------
    // 3. Extract commit ID
    // ------------------------------------------------------------
    const commitId = extractCommitId(commitResult);

    if (!commitId) {
      throw new Error(
        "Unable to determine the latest commit ID."
      );
    }

    // ------------------------------------------------------------
    // 4. Promote using GitHub Actions
    // ------------------------------------------------------------
    let deploymentResult;

    switch (targetEnvironment) {
      case "dev":
        deploymentResult = await promoteToDev(commitId);
        break;

      case "test":
        deploymentResult = await promoteToTest(commitId);
        break;

      case "prod":
        deploymentResult = await promoteToProd(commitId);
        break;

      default:
        // Defensive fallback.
        throw new Error(
          `Unsupported environment: ${targetEnvironment}`
        );
    }

    // ------------------------------------------------------------
    // 5. Verify deployment result
    // ------------------------------------------------------------
    if (!isSuccessful(deploymentResult)) {
      throw new Error(
        `Deployment to ${targetEnvironment.toUpperCase()} failed. ${
          getResultText(deploymentResult) ||
          "No additional details."
        }`
      );
    }

    // ------------------------------------------------------------
    // 6. Success response
    // ------------------------------------------------------------
    const deploymentText =
      getResultText(deploymentResult);

    return {
      content: [
        {
          type: "text",
          text:
            `✅ Release Agent completed successfully.\n\n` +
            `Environment: ${targetEnvironment.toUpperCase()}\n` +
            `Commit: ${commitId}\n` +
            `Deployment: ✅\n` +
            (deploymentText
              ? `\nDeployment Details:\n${deploymentText}`
              : "")
        }
      ]
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return {
      content: [
        {
          type: "text",
          text:
            `❌ Release Agent failed.\n\n` +
            `${message}`
        }
      ]
    };
  }
}