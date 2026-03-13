import { attachErrorHandler, createApp } from "../server/app";

const app = createApp();

attachErrorHandler(app);

export default app;
