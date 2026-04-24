import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://b09108995b3c483075e2d94726a83c20@o4511277328760832.ingest.de.sentry.io/4511277348880464",
  sendDefaultPii: true,
  environment: process.env.NODE_ENV || "development",
});

export default Sentry;
