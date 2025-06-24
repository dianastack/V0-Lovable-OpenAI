import { test } from "./helpers/test_helper";

test("upgrade app to capacitor", async ({ po }) => {
  await po.setUp();
  await po.sendPrompt("hi");
  await po.getTitleBarAppNameButton().click();
  await po.clickAppUpgradeButton({ upgradeId: "capacitor" });
  await po.expectNoAppUpgrades();

  await po.page.getByTestId("capacitor-controls").waitFor({ state: "visible" });
  await po.snapshotAppFiles();
});
