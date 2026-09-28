import { execSync } from "child_process";

export async function createFeatureBranch(featureName) {
  try {
    execSync("git checkout main", {
      stdio: "pipe"
    });

    execSync("git pull origin main", {
      stdio: "pipe"
    });

    execSync(`git checkout -b feature/${featureName}`, {
      stdio: "pipe"
    });

    return {
      content: [
        {
          type: "text",
          text: `Feature branch created successfully: feature/${featureName}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to create feature branch: ${error.message}`
        }
      ]
    };
  }
}