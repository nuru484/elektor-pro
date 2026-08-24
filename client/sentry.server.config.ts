// Node runtime Sentry setup (server components, route handlers, SSR).
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry-options";

Sentry.init(sentryOptions);
