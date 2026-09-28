const DEFAULT_REPO_OWNER = "Manigandan-v4";
const DEFAULT_REPO_NAME = "Agentic-AI";

function describeFailure(response, data, head, base) {
  if (response.status === 401) {
    return "GitHub rejected the credentials (401). Set GITHUB_TOKEN in the MCP server environment to a token with 'repo' scope.";
  }

  if (response.status === 403) {
    return `GitHub denied the request (403). The token may lack 'repo' scope or pull request permission. ${data.message || ""}`.trim();
  }

  if (response.status === 404) {
    return "Repository not found (404). Check repoOwner/repoName, and that the token can see the repository.";
  }

  if (response.status === 422) {
    const errors = (data.errors || [])
      .map((e) => e.message)
      .filter(Boolean);

    const existing = errors.find((m) =>
      m.includes("pull request already exists")
    );

    if (existing) {
      return `A pull request from ${head} into ${base} is already open.`;
    }

    if (errors.some((m) => m.includes("No commits between"))) {
      return `No commits between ${base} and ${head}, so there is nothing to open a pull request for. Push a commit to ${head} first.`;
    }

    if (errors.some((m) => m.includes("not exist"))) {
      return `Branch ${head} or ${base} does not exist on the remote. Push the branch before opening a pull request.`;
    }

    return `GitHub rejected the pull request (422): ${errors.join("; ") || data.message}`;
  }

  return `GitHub returned ${response.status}: ${data.message || JSON.stringify(data)}`;
}

export async function createPullRequest(
  sourceBranch,
  targetBranch,
  title,
  body,
  repoOwner,
  repoName
) {
  try {
    if (!sourceBranch || !targetBranch || !title) {
      throw new Error(
        "sourceBranch, targetBranch and title are all required."
      );
    }

    if (!process.env.GITHUB_TOKEN) {
      throw new Error(
        "GITHUB_TOKEN is not set in the MCP server environment."
      );
    }

    const owner = repoOwner || DEFAULT_REPO_OWNER;
    const repo = repoName || DEFAULT_REPO_NAME;

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          head: sourceBranch,
          base: targetBranch,
          body: body || "Created automatically via MCP."
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        describeFailure(
          response,
          data,
          sourceBranch,
          targetBranch
        )
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `Pull Request created: ${data.html_url}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to create PR: ${error.message}`
        }
      ]
    };
  }
}
