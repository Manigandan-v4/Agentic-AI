import { execSync } from "child_process";

export async function getCurrentBranch() {
  const branch = execSync(
    "git rev-parse --abbrev-ref HEAD"
  )
    .toString()
    .trim();

  return {
    content: [
      {
        type: "text",
        text: branch
      }
    ]
  };
}