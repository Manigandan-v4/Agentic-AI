import { execSync } from "child_process";

export async function promoteToTest(commitId) {
  try {
    execSync("git checkout test");
    execSync("git pull origin test");

    execSync(`git cherry-pick ${commitId}`);

    execSync("git push origin test");

    return {
      content: [
        {
          type: "text",
          text: `Commit ${commitId} promoted to test`
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