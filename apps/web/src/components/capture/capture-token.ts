export function captureTokenFromFragment(fragment: string): string | null {
  const token = new URLSearchParams(fragment.replace(/^#/, "")).get("token");

  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function retainCaptureToken(
  currentToken: string | null,
  fragment: string,
): string | null {
  return currentToken ?? captureTokenFromFragment(fragment);
}
