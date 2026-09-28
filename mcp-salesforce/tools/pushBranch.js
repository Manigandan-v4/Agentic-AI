import { execSync } from "child_process";

export async function pushBranch() {
  try {
    const branch = execSync(
      "git rev-parse --abbrev-ref HEAD"
    )
      .toString()
      .trim();

    execSync(`git push origin ${branch}`);

    return {
      content: [
        {
          type: "text",
          text: `Push successful: ${branch}`
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