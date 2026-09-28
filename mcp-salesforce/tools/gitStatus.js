import { execSync } from "child_process";

export async function gitStatus() {
  try {
    const status = execSync("git status --short")
      .toString()
      .trim();

    return {
      content: [
        {
          type: "text",
          text: status || "Working tree clean"
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