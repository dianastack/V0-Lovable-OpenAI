import { ipcMain } from "electron";
import { db } from "../../db";
import { messages, apps, chats } from "../../db/schema";
import { eq } from "drizzle-orm";
import { spawn } from "node:child_process";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getDyadAppPath } from "../../paths/paths";

const execPromise = promisify(exec);

export function registerDependencyHandlers() {
  ipcMain.handle(
    "chat:add-dep",
    async (
      _event,
      { chatId, packages }: { chatId: number; packages: string[] }
    ) => {
      // Find the message from the database
      const foundMessages = await db.query.messages.findMany({
        where: eq(messages.chatId, chatId),
      });

      // Find the chat first
      const chat = await db.query.chats.findFirst({
        where: eq(chats.id, chatId),
      });

      if (!chat) {
        throw new Error(`Chat ${chatId} not found`);
      }

      // Get the app using the appId from the chat
      const app = await db.query.apps.findFirst({
        where: eq(apps.id, chat.appId),
      });

      if (!app) {
        throw new Error(`App for chat ${chatId} not found`);
      }

      const message = [...foundMessages]
        .reverse()
        .find((m) =>
          m.content.includes(
            `<dyad-add-dependency packages="${packages.join(" ")}">`
          )
        );

      if (!message) {
        throw new Error(
          `Message with packages ${packages.join(", ")} not found`
        );
      }

      // Check if the message content contains the dependency tag
      const dependencyTagRegex = new RegExp(
        `<dyad-add-dependency packages="${packages.join(
          " "
        )}">[^<]*</dyad-add-dependency>`,
        "g"
      );

      if (!dependencyTagRegex.test(message.content)) {
        throw new Error(
          `Message doesn't contain the dependency tag for packages ${packages.join(
            ", "
          )}`
        );
      }

      // Execute npm install
      try {
        const { stdout, stderr } = await execPromise(
          `npm install ${packages.join(" ")}`,
          {
            cwd: getDyadAppPath(app.path),
          }
        );
        const installResults = stdout + (stderr ? `\n${stderr}` : "");

        // Update the message content with the installation results
        const updatedContent = message.content.replace(
          new RegExp(
            `<dyad-add-dependency packages="${packages.join(
              " "
            )}">[^<]*</dyad-add-dependency>`,
            "g"
          ),
          `<dyad-add-dependency packages="${packages.join(
            " "
          )}">${installResults}</dyad-add-dependency>`
        );

        // Save the updated message back to the database
        await db
          .update(messages)
          .set({ content: updatedContent })
          .where(eq(messages.id, message.id));

        // Return undefined implicitly
      } catch (error: any) {
        // Update the message with the error
        const updatedContent = message.content.replace(
          new RegExp(
            `<dyad-add-dependency packages="${packages.join(
              " "
            )}">[^<]*</dyad-add-dependency>`,
            "g"
          ),
          `<dyad-add-dependency packages="${packages.join(" ")}"><dyad-error>${
            error.message
          }</dyad-error></dyad-add-dependency>`
        );

        // Save the updated message back to the database
        await db
          .update(messages)
          .set({ content: updatedContent })
          .where(eq(messages.id, message.id));

        throw error;
      }
    }
  );
}
