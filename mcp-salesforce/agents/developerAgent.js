import { commitChanges } from "../tools/commitChanges.js";
import { createCustomField } from "../tools/createCustomField.js";
import { createFeatureBranch } from "../tools/createFeatureBranch.js";
import { createPullRequest } from "../tools/createPullRequest.js";
import { pushBranch } from "../tools/pushBranch.js";

/**
 * Extract a readable message from different tool result formats.
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
 * Determine whether a tool result should be considered successful.
 *
 * This supports:
 * - normal return values
 * - { success: true }
 * - MCP-style { content: [...] }
 * - tools that return nothing when successful
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
 * Convert user input into a safe branch name.
 */
function normalizeBranchName(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Validate Salesforce metadata input.
 */
function validateInput(objectName, fieldName, fieldType) {
  if (!objectName || !String(objectName).trim()) {
    throw new Error("objectName is required.");
  }

  if (!fieldName || !String(fieldName).trim()) {
    throw new Error("fieldName is required.");
  }

  if (!fieldType || !String(fieldType).trim()) {
    throw new Error("fieldType is required.");
  }

  const normalizedObjectName = String(objectName).trim();
  const normalizedFieldName = String(fieldName).trim();
  const normalizedFieldType = String(fieldType).trim();

  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalizedObjectName)) {
    throw new Error(
      `Invalid Salesforce object name: ${normalizedObjectName}`
    );
  }

  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalizedFieldName)) {
    throw new Error(
      `Invalid Salesforce field name: ${normalizedFieldName}`
    );
  }

  const allowedFieldTypes = new Set([
    "Text",
    "Number",
    "Checkbox",
    "Date",
    "DateTime",
    "Currency",
    "Email",
    "Phone",
    "Url",
    "Text Area",
    "Long Text Area"
  ]);

  const matchedType = [...allowedFieldTypes].find(
    (type) => type.toLowerCase() === normalizedFieldType.toLowerCase()
  );

  if (!matchedType) {
    throw new Error(
      `Unsupported field type: ${normalizedFieldType}. ` +
        `Supported types: ${[...allowedFieldTypes].join(", ")}`
    );
  }

  return {
    objectName: normalizedObjectName,
    fieldName: normalizedFieldName,
    fieldType: matchedType
  };
}

/**
 * Developer Agent
 *
 * Workflow:
 * 1. Validate request
 * 2. Create feature branch
 * 3. Create Salesforce field
 * 4. Commit changes
 * 5. Push branch
 * 6. Create Pull Request
 */
export async function developerAgent(
  objectName,
  fieldName,
  fieldType
) {
  const status = {
    branch: {
      success: false,
      result: null
    },
    metadata: {
      success: false,
      result: null
    },
    commit: {
      success: false,
      result: null
    },
    push: {
      success: false,
      result: null
    },
    pullRequest: {
      success: false,
      result: null
    }
  };

  try {
    // ------------------------------------------------------------
    // 1. Validate input
    // ------------------------------------------------------------
    const input = validateInput(
      objectName,
      fieldName,
      fieldType
    );

    const safeBranchName = normalizeBranchName(
      `${input.objectName}-${input.fieldName}`
    );

    if (!safeBranchName) {
      throw new Error("Unable to generate a valid feature branch name.");
    }

    const branchName = `feature/${safeBranchName}`;
    const fieldApiName = `${input.fieldName}__c`;

    // ------------------------------------------------------------
    // 2. Create feature branch
    // ------------------------------------------------------------
    const branchResult = await createFeatureBranch(
      safeBranchName
    );

    status.branch.result = branchResult;
    status.branch.success = isSuccessful(branchResult);

    if (!status.branch.success) {
      throw new Error(
        `Feature branch creation failed. ${
          getResultText(branchResult) || "No additional details."
        }`
      );
    }

    // ------------------------------------------------------------
    // 3. Create Salesforce custom field
    // ------------------------------------------------------------
    const metadataResult = await createCustomField(
      input.objectName,
      input.fieldName,
      input.fieldType
    );

    status.metadata.result = metadataResult;
    status.metadata.success = isSuccessful(metadataResult);

    if (!status.metadata.success) {
      throw new Error(
        `Salesforce field creation failed. ${
          getResultText(metadataResult) || "No additional details."
        }`
      );
    }

    // ------------------------------------------------------------
    // 4. Commit changes
    // ------------------------------------------------------------
    const commitMessage =
      `Added ${fieldApiName} on ${input.objectName}`;

    const commitResult = await commitChanges(
      commitMessage
    );

    status.commit.result = commitResult;
    status.commit.success = isSuccessful(commitResult);

    if (!status.commit.success) {
      throw new Error(
        `Commit failed. ${
          getResultText(commitResult) || "No additional details."
        }`
      );
    }

    // ------------------------------------------------------------
    // 5. Push branch
    // ------------------------------------------------------------
    const pushResult = await pushBranch();

    status.push.result = pushResult;
    status.push.success = isSuccessful(pushResult);

    if (!status.push.success) {
      throw new Error(
        `Branch push failed. ${
          getResultText(pushResult) || "No additional details."
        }`
      );
    }

    // ------------------------------------------------------------
    // 6. Create Pull Request
    // ------------------------------------------------------------
    const pullRequestTitle =
      `Add ${input.fieldName} field on ${input.objectName}`;

    const pullRequestResult = await createPullRequest(
      branchName,
      "devagent1",
      pullRequestTitle
    );

    status.pullRequest.result = pullRequestResult;
    status.pullRequest.success =
      isSuccessful(pullRequestResult);

    if (!status.pullRequest.success) {
      throw new Error(
        `Pull Request creation failed. ${
          getResultText(pullRequestResult) ||
          "No additional details."
        }`
      );
    }

    // ------------------------------------------------------------
    // 7. Success response
    // ------------------------------------------------------------
    const prText = getResultText(pullRequestResult);

    return {
      content: [
        {
          type: "text",
          text:
            `✅ Developer Agent completed successfully.\n\n` +
            `Object: ${input.objectName}\n` +
            `Field: ${fieldApiName}\n` +
            `Field Type: ${input.fieldType}\n` +
            `Branch: ${branchName}\n` +
            `Commit: ✅\n` +
            `Push: ✅\n` +
            `Pull Request: ✅\n` +
            (prText ? `\nPR Details:\n${prText}` : "")
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
            `❌ Developer Agent failed.\n\n` +
            `${message}\n\n` +
            `Execution status:\n` +
            `Branch: ${
              status.branch.success ? "✅" : "❌"
            }\n` +
            `Metadata: ${
              status.metadata.success ? "✅" : "❌"
            }\n` +
            `Commit: ${
              status.commit.success ? "✅" : "❌"
            }\n` +
            `Push: ${
              status.push.success ? "✅" : "❌"
            }\n` +
            `Pull Request: ${
              status.pullRequest.success ? "✅" : "❌"
            }`
        }
      ]
    };
  }
}