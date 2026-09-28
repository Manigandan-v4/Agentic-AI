import { execSync } from "child_process";

export async function getLastCommit() {
  try {
    const commit = execSync(
      'git log -1 --pretty=format:"%H%n%an <%ae>%n%ad%n%s"'
    )
      .toString()
      .trim();

    const [hash, author, date, subject] =
      commit.split("\n");

    return {
      content: [
        {
          type: "text",
          text: [
            `Commit: ${hash}`,
            `Author: ${author}`,
            `Date: ${date}`,
            `Subject: ${subject}`
          ].join("\n")
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to get last commit: ${error.message}`
        }
      ]
    };
  }
}
