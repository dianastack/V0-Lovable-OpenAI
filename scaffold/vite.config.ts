import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export function devErrorAndNavigationPlugin(): Plugin {
  return {
    name: "dev-error-and-navigation-handler",
    apply: "serve",
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: "script",
            injectTo: "head",
            children: `
              (function() {
                // Check if running inside an iframe immediately
                const isInsideIframe = window.parent !== window;
                if (!isInsideIframe) {
                  // If not in an iframe, no need for the rest of the script
                  // console.log('[vite-dev-navigation] Not inside an iframe. Skipping setup.');
                  return;
                }

                // Use a unique key for our timestamp to avoid conflicts (optional, but kept for state consistency)
                const NAV_TIMESTAMP_KEY = '__viteDevNavTimestamp';
                let previousUrl = window.location.href;
                let lastNavigationTimestamp = Date.now(); // Initialize with current time

                // --- Initial State Timestamp Setup (Optional but helps consistency) ---
                try {
                    const initialState = history.state || {};
                    if (!initialState[NAV_TIMESTAMP_KEY]) {
                       initialState[NAV_TIMESTAMP_KEY] = lastNavigationTimestamp;
                       // Use try-catch for replaceState as well, in case state is not serializable initially
                       try {
                           history.replaceState(initialState, '', window.location.href);
                           // console.log('[vite-dev-navigation] Initial navigation timestamp set:', lastNavigationTimestamp);
                       } catch(replaceError) {
                            console.warn('[vite-dev-navigation] Could not set initial navigation timestamp via replaceState:', replaceError);
                       }
                    } else {
                       lastNavigationTimestamp = initialState[NAV_TIMESTAMP_KEY];
                       // console.log('[vite-dev-navigation] Using existing initial navigation timestamp:', lastNavigationTimestamp);
                    }
                } catch (e) {
                    console.warn('[vite-dev-navigation] Could not access or modify initial history state:', e);
                }

                // --- History API Overrides ---
                const originalPushState = history.pushState;
                const originalReplaceState = history.replaceState;

                const handleStateChangeAndNotify = (originalMethod, state, title, url) => {
                  const newTimestamp = Date.now();
                  const oldUrlForMessage = previousUrl; // Capture previous URL before potential change

                  // Prepare new state with timestamp
                  let newState = state || {};
                  if (typeof newState !== 'object' || newState === null) {
                      newState = {};
                  } else if (Object.isFrozen(newState)) { // Handle frozen state objects
                      newState = { ...newState };
                  }
                  newState[NAV_TIMESTAMP_KEY] = newTimestamp;

                  // Determine the intended new URL *before* calling the original method
                  let newUrl;
                  try {
                    // Resolve the potentially relative URL against the current location
                    newUrl = url ? new URL(url, window.location.href).href : window.location.href;
                  } catch (e) {
                    console.warn('[vite-dev-navigation] Error constructing URL:', url, e);
                    newUrl = window.location.href; // Fallback
                  }

                  // Determine the type of operation
                  const navigationType = (originalMethod === originalPushState ? 'pushState' : 'replaceState');

                  // Call the original history method
                  try {
                      originalMethod.call(history, newState, title, url);
                      // Update internal state *after* successful call
                      lastNavigationTimestamp = newTimestamp;
                      previousUrl = window.location.href; // Use the actual URL after the call

                      // Post message to parent *after* successful state change
                      // Use the 'newUrl' we calculated earlier as the intended target
                      // Use 'oldUrlForMessage' as the URL before this operation started
                      // console.log(\`[vite-dev-navigation] Emitting message: { type: '\${navigationType}', payload: { oldUrl: '\${oldUrlForMessage}', newUrl: '\${newUrl}' } }\`);
                      window.parent.postMessage({
                        type: navigationType, // 'pushState' or 'replaceState'
                        payload: {
                          oldUrl: oldUrlForMessage,
                          newUrl: newUrl // The URL passed to pushState/replaceState, resolved
                        }
                      }, '*'); // Consider a specific targetOrigin

                  } catch (e) {
                      console.error(\`[vite-dev-navigation] Error calling original \${navigationType}: \`, e);
                      // Optionally notify parent about the error during navigation attempt
                      window.parent.postMessage({
                        type: 'navigation-error',
                        payload: {
                           operation: navigationType,
                           message: e.message,
                           error: e.toString(),
                           stateAttempted: state, // Be careful sending state, might be large or sensitive
                           urlAttempted: url
                        }
                      }, '*');
                  }
                };

                history.pushState = function(state, title, url) {
                  handleStateChangeAndNotify(originalPushState, state, title, url);
                };

                history.replaceState = function(state, title, url) {
                   handleStateChangeAndNotify(originalReplaceState, state, title, url);
                };

                // --- Listener for Back/Forward Navigation (popstate event) ---
                // We keep this listener primarily to update our internal 'previousUrl'
                // and 'lastNavigationTimestamp' state so that subsequent push/replace
                // messages report the correct 'oldUrl'. We no longer send messages from here.
                window.addEventListener('popstate', (event) => {
                  const currentUrl = window.location.href;
                  // console.log('[vite-dev-navigation] Popstate event detected. Previous URL was:', previousUrl, 'New URL is:', currentUrl);

                  const newStateTimestamp = event.state?.[NAV_TIMESTAMP_KEY];
                  if (typeof newStateTimestamp === 'number') {
                      lastNavigationTimestamp = newStateTimestamp; // Update timestamp from popped state
                      // console.log('[vite-dev-navigation] Updated lastNavigationTimestamp from popstate:', lastNavigationTimestamp);
                  } else {
                      // console.warn('[vite-dev-navigation] Popstate event state missing navigation timestamp.');
                      // If timestamp is missing, we might lose track, but there's not much we can do reliably.
                      // Keep the last known timestamp.
                  }

                  // Update previousUrl to reflect the new reality AFTER the popstate event
                  previousUrl = currentUrl;
                });

                // --- Listener for Commands from Parent ---
                window.addEventListener('message', (event) => {
                    // Security check: Ensure message is from parent
                    if (event.source !== window.parent || !event.data || typeof event.data !== 'object') {
                        return;
                    }

                    if (event.data.type === 'navigate') {
                        const direction = event.data.payload?.direction;
                        // console.log(\`[vite-dev-navigation] Received command: \${direction}\`);

                        if (direction === 'forward') {
                            history.forward();
                        } else if (direction === 'backward') {
                            history.back();
                        } else {
                            console.warn('[vite-dev-navigation] Received navigate command with invalid direction:', direction);
                        }
                    }
                });


                // --- Existing Error Handling ---
                window.addEventListener('error', (event) => {
                  // console.log('[vite-dev-navigation] Forwarding error event to parent.');
                  window.parent.postMessage({
                    type: 'window-error',
                    payload: {
                      message: event.message,
                      filename: event.filename,
                      lineno: event.lineno,
                      colno: event.colno,
                      error: event.error?.toString() // Include stack trace if available
                    }
                  }, '*');
                });

                window.addEventListener('unhandledrejection', (event) => {
                   // console.log('[vite-dev-navigation] Forwarding unhandledrejection event to parent.');
                   window.parent.postMessage({
                     type: 'unhandled-rejection',
                     payload: {
                       reason: event.reason instanceof Error ? event.reason.toString() : JSON.stringify(event.reason) // Attempt to serialize reason
                     }
                   }, '*');
                });

                // console.log('[vite-dev-navigation] Navigation/error script initialized inside iframe. Initial URL:', previousUrl, 'Initial Timestamp:', lastNavigationTimestamp);

              })(); // End of IIFE
            `,
          },
        ],
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), devErrorAndNavigationPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
