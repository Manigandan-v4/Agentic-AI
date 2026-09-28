import { execSync } from "child_process";

export async function promoteToDev(commitId) {
  try {
    execSync("git checkout devagent1");
    execSync("git pull origin devagent1");

    execSync(`git cherry-pick ${commitId}`);

    execSync("git push origin devagent1");

    return {
      content: [
        {
          type: "text",
          text: `Commit ${commitId} promoted to devagent1`
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