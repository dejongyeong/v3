This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

[![codecov](https://codecov.io/gh/dejongyeong/v3/branch/main/graph/badge.svg?token=ulTrW6iqLL)](https://codecov.io/gh/dejongyeong/v3)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Integration & E2E Testing

The project uses Playwright for integration and end-to-end testing. You can run the tests with the following commands:

```shell
npx playwright install # only for the first time in a new development
npm run test:e2e
```

Visual testing only runs in GitHub Actions. In GitHub Actions, define the <code>PERCY_TOKEN</code> environment variable and paste the token.

Guide to integrate Playwright tests with Percy can be found [here](https://www.browserstack.com/docs/percy/integrate/playwright).

## Monitoring as Code using Checkly

The project can use [Checkly](https://www.checklyhq.com/) to ensure production environment is always up and running. At regular intervals, Checkly runs the tests ending with <code>\*.check.e2e.ts</code> extension and notifies author if any of the tests fail. Additionally, authors have the flexibility to run checks on APIs or execute tests from multiple locations to ensure that application is available worldwide.

## Web Analytics using PostHog

The project can use [PostHog](https://posthog.com/docs/web-analytics) to track and monitor the application. For example, PostHog can be adopted to track users without cookies for compliance and privacy or calculate average session duration and time on site. It is especially useful for marketers, content creators, or anyone used to tools like Google Analytics. It includes a dashboard that offers essential metrics, such as visitors, views, sessions, session duration, bounce rate, conversions, paths, referrers, and more.

Guide to install PostHog Web Analytics on Next.js project can be found [here](https://posthog.com/docs/web-analytics/installation?tab=Next.js).

## Error Monitoring

The project can use [Sentry](https://sentry.io/welcome/?utm_source=github&utm_medium=paid-community&utm_campaign=general-fy25q1-nextjs&utm_content=github-banner-nextjsboilerplate-logo) to monitor errors. In the development environment, the authors can use Spotlight (Sentry for Development). All errors will automatically be sent to the local Spotlight instance, allowing developers to experience Sentry locally. By default, development environment is used. In GitHub Actions, define the <code>SENTRY_AUTH_TOKEN</code> environment variable and paste the token

For production environment, a Sentry account is needed. Guide to setup Sentry in Next.js project can be found [here](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup)

Acknowledge: [Next-js-Boilerplate](https://github.com/ixartz/Next-js-Boilerplate/tree/main) from Ixartz.
