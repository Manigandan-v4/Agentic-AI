import { commitChanges } from "../tools/commitChanges.js";
import { createCustomField } from "../tools/createCustomField.js";
import { createFeatureBranch } from "../tools/createFeatureBranch.js";
import { createPullRequest } from "../tools/createPullRequest.js";
import { pushBranch } from "../tools/pushBranch.js";

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

  return result?.message || "";
}

function isSuccessful(result) {
  if (!result) {
    return false;
  }

  if (typeof result.success === "boolean") {
    return result.success;
  }

  if (typeof result.ok === "boolean") {
    return result.ok;
  }

  const text = getResultText(result).toLowerCase();

  return !(
    text.includes("failed") ||
    text.includes("error") ||
    text.includes("❌")
  );
}

function normalizeBranchName(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeRequest(args) {
  if (Array.isArray(args?.changes)) {
    return args.changes;
  }

  if (args?.objectName && args?.fieldName && args?.fieldType) {
    return [
      {
        type: "field",
        objectName: args.objectName,
        fieldName: args.fieldName,
        fieldType: args.fieldType
      }
    ];
  }

  throw new Error("No valid Salesforce changes were provided.");
}

function validateChange(change) {
  if (!change) {
    throw new Error("Invalid empty change.");
  }

  const type = String(change.type || "").trim().toLowerCase();

  if (type !== "field") {
    throw new Error(`Unsupported change type: ${change.type}`);
  }

  if (!change.objectName || !change.fieldName || !change.fieldType) {
    throw new Error("Each field change requires objectName, fieldName and fieldType.");
  }

  return {
    type: "field",
    objectName: String(change.objectName).trim(),
    fieldName: String(change.fieldName).trim(),
    fieldType: String(change.fieldType).trim()
  };
}

function collectFiles(target, result) {
  if (Array.isArray(result?.changedFiles)) {
    for (const file of result.changedFiles) {
      if (file && !target.includes(file)) {
        target.push(file);
      }
    }
  }
}

export async function developerAgent(objectNameOrArgs, fieldName, fieldType) {
  const changedFiles = [];

  const args =
    typeof objectNameOrArgs === "object" && objectNameOrArgs !== null
      ? objectNameOrArgs
      : {
          objectName: objectNameOrArgs,
          fieldName,
          fieldType
        };

  const changes = normalizeRequest(args).map(validateChange);

  const status = {
    branch: false,
    metadata: false,
    commit: false,
    push: false,
    pullRequest: false
  };

  try {
    if (changes.length === 0) {
      throw new Error("At least one Salesforce change is required.");
    }

    const branchParts = [
      changes[0].objectName,
      "changes",
      ...changes.map((change) => change.fieldName)
    ];
    const featureName = normalizeBranchName(branchParts.join("-"));

    if (!featureName) {
      throw new Error("Unable to generate a feature branch name.");
    }

    const branchName = `feature/${featureName}`;

    const branchResult = await createFeatureBranch(featureName);
    status.branch = isSuccessful(branchResult);

    if (!status.branch) {
      throw new Error(getResultText(branchResult) || "Feature branch creation failed.");
    }

    for (const change of changes) {
      if (change.type === "field") {
        const result = await createCustomField(change.objectName, change.fieldName, change.fieldType);

        if (!isSuccessful(result)) {
          throw new Error(getResultText(result) || `Failed to create field ${change.fieldName}.`);
        }

        collectFiles(changedFiles, result);
      }
    }

    if (changedFiles.length === 0) {
      throw new Error("No agent-owned files were produced. Commit blocked.");
    }

    status.metadata = true;

    const commitMessage =
      changes.length === 1
        ? `Salesforce change: ${changes[0].objectName}.${changes[0].fieldName}__c`
        : `Salesforce change: ${changes.length} changes on ${changes[0].objectName}`;

    const commitResult = await commitChanges(commitMessage, changedFiles);
    status.commit = isSuccessful(commitResult);

    if (!status.commit) {
      throw new Error(getResultText(commitResult) || "Commit failed.");
    }

    const pushResult = await pushBranch();
    status.push = isSuccessful(pushResult);

    if (!status.push) {
      throw new Error(getResultText(pushResult) || "Push failed.");
    }

    const changeSummary = changes
      .map((change) => `- ${change.objectName}.${change.fieldName}__c (${change.fieldType})`)
      .join("\n");

    const prResult = await createPullRequest(
      branchName,
      "devagent1",
      changes.length === 1
        ? `Add ${changes[0].fieldName} field on ${changes[0].objectName}`
        : `Salesforce change: ${changes.length} changes`,
      [
        "Created automatically by Salesforce MCP Developer Agent.",
        "",
        "Requested changes:",
        changeSummary,
        "",
        `Files committed: ${changedFiles.length}`,
        ...changedFiles.map((file) => `- ${file}`),
        "",
        `Commit: ${commitResult.commitId || "unknown"}`
      ].join("\n")
    );

    status.pullRequest = isSuccessful(prResult);

    if (!status.pullRequest) {
      throw new Error(getResultText(prResult) || "Pull Request creation failed.");
    }

    return {
      success: true,
      branchName,
      changedFiles,
      commitId: commitResult.commitId,
      pullRequestUrl: prResult.pullRequestUrl,
      content: [
        {
          type: "text",
          text:
            `✅ Developer Agent completed successfully.\n\n` +
            `Changes requested: ${changes.length}\n` +
            changes
              .map((change) => `- ${change.objectName}.${change.fieldName}__c (${change.fieldType})`)
              .join("\n") +
            `\n\nFiles committed: ${changedFiles.length}\n` +
            changedFiles.map((file) => `- ${file}`).join("\n") +
            `\n\nBranch: ${branchName}\n` +
            `Commit: ${commitResult.commitId}\n` +
            `PR: ${prResult.pullRequestUrl || getResultText(prResult)}`
        }
      ]
    };
  } catch (error) {
    return {
      success: false,
      changedFiles,
      content: [
        {
          type: "text",
          text:
            `❌ Developer Agent failed.\n\n` +
            `${error instanceof Error ? error.message : String(error)}\n\n` +
            `Agent-owned files: ${changedFiles.length}\n` +
            (changedFiles.length ? changedFiles.map((file) => `- ${file}`).join("\n") : "None") +
            `\n\nExecution status:\n` +
            `Branch: ${status.branch ? "✅" : "❌"}\n` +
            `Metadata: ${status.metadata ? "✅" : "❌"}\n` +
            `Commit: ${status.commit ? "✅" : "❌"}\n` +
            `Push: ${status.push ? "✅" : "❌"}\n` +
            `PR: ${status.pullRequest ? "✅" : "❌"}`
        }
      ]
    };
  }
}
