import { execSync } from "child_process";

export async function promoteToProd(commitId) {
  try {
    execSync("git checkout main");
    execSync("git pull origin main");

    execSync(`git cherry-pick ${commitId}`);

    execSync("git push origin main");

    return {
      content: [
        {
          type: "text",
          text: `Commit ${commitId} promoted to production`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: error.message
        }
      ]
    };
  }
}