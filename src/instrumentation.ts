/**
 * NEXT.JS INSTRUMENTATION HOOK
 * Automatically called by Next.js once on server initialization.
 * Starts our in-process cron daemon for PipeOps production deployments.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startInternalCronScheduler } = await import('@/lib/cron/scheduler');
    startInternalCronScheduler();
  }
}
