// Client-side email checks that mirror the sign-in system's rejection of
// placeholder, reserved and commonly mistyped domains.
const RESERVED = /(^|\.)(example\.(com|net|org)|test|invalid|localhost|local|example)$/i;
const BLOCKED = new Set(["mailinator.com", "test.com", "email.com", "domain.com", "yourdomain.com"]);
const TYPOS: Record<string, string> = {
  "gmai.com": "gmail.com", "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmaill.com": "gmail.com", "gnail.com": "gmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com",
  "hotmal.com": "hotmail.com", "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com", "outlook.co": "outlook.com", "outlook.con": "outlook.com",
  "icloud.co": "icloud.com", "iclod.com": "icloud.com",
};

/** Returns a user-facing correction message, or null when the email looks valid. */
export function validateEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email) return "Email is required.";
  if (email.length > 255) return "Email must be under 255 characters.";
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.includes(".."))
    return "Enter a full email address, like name@gmail.com.";
  const domain = email.split("@")[1];
  const fix = TYPOS[domain];
  if (fix) return `Did you mean ${email.split("@")[0]}@${fix}? "${domain}" looks mistyped.`;
  if (RESERVED.test(domain) || BLOCKED.has(domain))
    return `"${domain}" is a placeholder or reserved domain and can't receive email. Use your real address.`;
  return null;
}
