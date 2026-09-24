// Turns Supabase Auth errors into messages customers can act on.
type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

export function authMessage(error: AuthErrorLike, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const code = error.code || '';
  const text = error.message || '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) return 'The email or password is incorrect.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(text)) return 'Please confirm your email first. Open the link we sent you, or send a new one below.';
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(text)) return 'An account with this email already exists. Sign in, or reset your password if you forgot it.';
  if (code === 'weak_password' || /password should/i.test(text)) return `Please choose a stronger password.${text ? ` ${text}` : ''}`;
  if (code === 'email_address_invalid' || /email address .* is invalid/i.test(text)) return 'Please enter a valid email address.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429 || /rate limit/i.test(text)) return 'Too many attempts right now. Please wait a few minutes and try again.';
  if (code === 'signup_disabled' || /signups not allowed/i.test(text)) return 'New accounts are not open right now. Please contact us on WhatsApp.';
  if (/error sending (confirmation|recovery|magic link)? ?email/i.test(text)) return 'We could not send the confirmation email. Please try again later or contact us on WhatsApp.';
  if (/failed to fetch|network/i.test(text)) return 'Could not reach the server. Check your connection and try again.';
  return text || fallback;
}

export const needsConfirmation = (error: AuthErrorLike) => Boolean(error && (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message || '')));
