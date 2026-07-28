import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
/ Navigates back to the previous screen in browser navigation history.
/ If no previous history exists (e.g. opened directly from link), falls back gracefully.
*/
export function navigateBack(router: AppRouterInstance, fallbackUrl: string = '/') {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    router.push(fallbackUrl);
  }
}
