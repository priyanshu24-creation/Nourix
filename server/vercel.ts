import { attachErrorHandler, createApp } from "./app.js";

const app = createApp();

attachErrorHandler(app);

export default app;
