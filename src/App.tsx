import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";

// The router is automatically initialized by RouterProvider
// so we don't need to call initialize() manually

function App() {
  return <RouterProvider router={router} />;
}

export default App;
