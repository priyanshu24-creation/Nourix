import { attachErrorHandler, createApp } from "./app";

const app = createApp();

attachErrorHandler(app);

export default app;
