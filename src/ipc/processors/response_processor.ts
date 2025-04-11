import { db } from "../../db";
import { chats } from "../../db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import { getDyadAppPath } from "../../paths/paths";
import path from "node:path";
import git from "isomorphic-git";

export function getDyadWriteTags(fullResponse: string): {
  path: string;
  content: string;
}[] {
  const dyadWriteRegex =
    /<dyad-write path="([^"]+)"[^>]*>([\s\S]*?)<\/dyad-write>/g;
  let match;
  const tags: { path: string; content: string }[] = [];
  while ((match = dyadWriteRegex.exec(fullResponse)) !== null) {
    tags.push({ path: match[1], content: match[2] });
  }
  return tags;
}

export function getDyadRenameTags(fullResponse: string): {
  from: string;
  to: string;
}[] {
  const dyadRenameRegex =
    /<dyad-rename from="([^"]+)" to="([^"]+)"[^>]*>([\s\S]*?)<\/dyad-rename>/g;
  let match;
  const tags: { from: string; to: string }[] = [];
  while ((match = dyadRenameRegex.exec(fullResponse)) !== null) {
    tags.push({ from: match[1], to: match[2] });
  }
  return tags;
}

export function getDyadDeleteTags(fullResponse: string): string[] {
  const dyadDeleteRegex =
    /<dyad-delete path="([^"]+)"[^>]*>([\s\S]*?)<\/dyad-delete>/g;
  let match;
  const paths: string[] = [];
  while ((match = dyadDeleteRegex.exec(fullResponse)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

export function getDyadAddDependencyTags(fullResponse: string): string[] {
  const dyadAddDependencyRegex =
    /<dyad-add-dependency package="([^"]+)">[^<]*<\/dyad-add-dependency>/g;
  let match;
  const packages: string[] = [];
  while ((match = dyadAddDependencyRegex.exec(fullResponse)) !== null) {
    packages.push(match[1]);
  }
  return packages;
}

export async function processFullResponseActions(
  fullResponse: string,
  chatId: number,
  { chatSummary }: { chatSummary: string | undefined }
): Promise<{ updatedFiles?: boolean; error?: string }> {
  // Get the app associated with the chat
  const chatWithApp = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    with: {
      app: true,
    },
  });
  if (!chatWithApp || !chatWithApp.app) {
    console.error(`No app found for chat ID: ${chatId}`);
    return {};
  }

  const appPath = getDyadAppPath(chatWithApp.app.path);
  const writtenFiles: string[] = [];
  const renamedFiles: string[] = [];
  const deletedFiles: string[] = [];

  try {
    // Extract all tags
    const dyadWriteTags = getDyadWriteTags(fullResponse);
    const dyadRenameTags = getDyadRenameTags(fullResponse);
    const dyadDeletePaths = getDyadDeleteTags(fullResponse);
    const dyadAddDependencyPackages = getDyadAddDependencyTags(fullResponse);

    // If no tags to process, return early
    if (
      dyadWriteTags.length === 0 &&
      dyadRenameTags.length === 0 &&
      dyadDeletePaths.length === 0 &&
      dyadAddDependencyPackages.length === 0
    ) {
      return {};
    }

    // Process all file writes
    for (const tag of dyadWriteTags) {
      const filePath = tag.path;
      const content = tag.content;
      const fullFilePath = path.join(appPath, filePath);

      // Ensure directory exists
      const dirPath = path.dirname(fullFilePath);
      fs.mkdirSync(dirPath, { recursive: true });

      // Write file content
      fs.writeFileSync(fullFilePath, content);
      console.log(`Successfully wrote file: ${fullFilePath}`);
      writtenFiles.push(filePath);
    }

    // Process all file renames
    for (const tag of dyadRenameTags) {
      const fromPath = path.join(appPath, tag.from);
      const toPath = path.join(appPath, tag.to);

      // Ensure target directory exists
      const dirPath = path.dirname(toPath);
      fs.mkdirSync(dirPath, { recursive: true });

      // Rename the file
      if (fs.existsSync(fromPath)) {
        fs.renameSync(fromPath, toPath);
        console.log(`Successfully renamed file: ${fromPath} -> ${toPath}`);
        renamedFiles.push(tag.to);

        // Add the new file and remove the old one from git
        await git.add({
          fs,
          dir: appPath,
          filepath: tag.to,
        });
        try {
          await git.remove({
            fs,
            dir: appPath,
            filepath: tag.from,
          });
        } catch (error) {
          console.warn(`Failed to git remove old file ${tag.from}:`, error);
          // Continue even if remove fails as the file was still renamed
        }
      } else {
        console.warn(`Source file for rename does not exist: ${fromPath}`);
      }
    }

    // Process all file deletions
    for (const filePath of dyadDeletePaths) {
      const fullFilePath = path.join(appPath, filePath);

      // Delete the file if it exists
      if (fs.existsSync(fullFilePath)) {
        fs.unlinkSync(fullFilePath);
        console.log(`Successfully deleted file: ${fullFilePath}`);
        deletedFiles.push(filePath);

        // Remove the file from git
        try {
          await git.remove({
            fs,
            dir: appPath,
            filepath: filePath,
          });
        } catch (error) {
          console.warn(`Failed to git remove deleted file ${filePath}:`, error);
          // Continue even if remove fails as the file was still deleted
        }
      } else {
        console.warn(`File to delete does not exist: ${fullFilePath}`);
      }
    }

    // If we have any file changes, commit them all at once
    const hasChanges =
      writtenFiles.length > 0 ||
      renamedFiles.length > 0 ||
      deletedFiles.length > 0;
    if (hasChanges) {
      // Stage all written files
      for (const file of writtenFiles) {
        await git.add({
          fs,
          dir: appPath,
          filepath: file,
        });
      }

      // Create commit with details of all changes
      const changes = [];
      if (writtenFiles.length > 0)
        changes.push(`wrote ${writtenFiles.length} file(s)`);
      if (renamedFiles.length > 0)
        changes.push(`renamed ${renamedFiles.length} file(s)`);
      if (deletedFiles.length > 0)
        changes.push(`deleted ${deletedFiles.length} file(s)`);

      await git.commit({
        fs,
        dir: appPath,
        message: chatSummary
          ? `[dyad] ${chatSummary} - ${changes.join(", ")}`
          : `[dyad] ${changes.join(", ")}`,
        author: {
          name: "Dyad AI",
          email: "dyad-ai@example.com",
        },
      });
      console.log(`Successfully committed changes: ${changes.join(", ")}`);
      return { updatedFiles: true };
    }

    return {};
  } catch (error: unknown) {
    console.error("Error processing files:", error);
    return { error: (error as any).toString() };
  }
}
