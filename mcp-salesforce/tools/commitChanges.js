import { execSync } from "child_process";

export async function commitChanges(message) {
  try {
    execSync("git add .");
    execSync(`git commit -m "${message}"`);

    return {
      content: [
        {
          type: "text",
          text: `Commit successful: ${message}`
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