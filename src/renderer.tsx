import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router";
import { RouterProvider } from "@tanstack/react-router";
import { PostHogProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { getTelemetryUserId, isTelemetryOptedIn } from "./hooks/useSettings";

const posthogClient = posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: "https://us.i.posthog.com",
  debug: import.meta.env.MODE === "development",
  autocapture: false,
  capture_pageview: false,
  before_send: (event) => {
    if (!isTelemetryOptedIn()) {
      console.debug("Telemetry not opted in, skipping event", event);
      return null;
    }
    const telemetryUserId = getTelemetryUserId();
    if (telemetryUserId) {
      posthogClient.identify(telemetryUserId);
    }

    if (event?.properties["$ip"]) {
      event.properties["$ip"] = null;
    }

    console.debug(
      "Telemetry opted in - UUID:",
      telemetryUserId,
      "sending event",
      event
    );
    return event;
  },
  persistence: "localStorage",
});

function App() {
  useEffect(() => {
    // Subscribe to navigation state changes
    const unsubscribe = router.subscribe("onResolved", (navigation) => {
      // Capture the navigation event in PostHog
      posthog.capture("navigation", {
        toPath: navigation.toLocation.pathname,
        fromPath: navigation.fromLocation?.pathname,
      });

      // Optionally capture as a standard pageview as well
      posthog.capture("$pageview", {
        path: navigation.toLocation.pathname,
      });
    });

    // Clean up subscription when component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  return <RouterProvider router={router} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthogClient}>
      <App />
    </PostHogProvider>
  </StrictMode>
);
