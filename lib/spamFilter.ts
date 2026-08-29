// Spam content filtering for contact form submissions

// Common spam keywords/phrases (case-insensitive)
const SPAM_KEYWORDS = [
  // SEO/Link building spam
  "seo services",
  "link building",
  "backlink",
  "guest post",
  "guest posting",
  "sponsored post",
  "article submission",
  "directory submission",
  "search engine optimization",
  "improve your ranking",
  "first page of google",
  "rank higher",
  "organic traffic",
  "domain authority",
  "moz da",
  "ahrefs dr",

  // Casino/Gambling
  "casino",
  "gambling",
  "betting",
  "poker",
  "slot",
  "jackpot",
  "online casino",
  "free spins",
  "no deposit bonus",

  // Crypto/Financial scams
  "cryptocurrency",
  "bitcoin investment",
  "crypto trading",
  "forex trading",
  "binary options",
  "investment opportunity",
  "passive income",
  "make money online",
  "work from home",
  "earn $",
  "financial freedom",

  // Pharma/Health spam
  "viagra",
  "cialis",
  "pharmacy",
  "prescription",
  "generic drugs",
  "online pharmacy",
  "weight loss",
  "diet pill",
  "male enhancement",

  // Adult content
  "adult",
  "porn",
  "xxx",
  "sex",
  "escort",
  "dating site",
  "hookup",

  // Generic spam patterns
  "dear sir",
  "dear madam",
  "dear friend",
  "i am writing to",
  "business proposal",
  "partnership opportunity",
  "mutual benefit",
  "long term cooperation",
  "respected sir",
  "esteemed customer",

  // Marketing spam
  "bulk email",
  "mass email",
  "email marketing",
  "mailing list",
  "lead generation",
  "sales leads",
  "marketing list",
  "opt-in list",
  "permission based",

  // Fake inquiry patterns
];

// Suspicious patterns (regex-based)
const SUSPICIOUS_PATTERNS = [
  // Multiple URLs
  /(https?:\/\/[^\s]+){2,}/gi,
  // Email addresses in message body (not the email field)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  // Phone numbers with country codes (often spam)
  /\+?\d{1,3}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  // Bitcoin/crypto addresses
  /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
  /\bbc1[a-zA-HJ-NP-Z0-9]{39,59}\b/g,
  // Excessive capitalization
  /\b[A-Z]{4,}\b/g,
  // Repeated characters
  /(.)\1{4,}/g,
];

// Disposable email domains (common temporary email providers)
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "tempmail.com",
  "tempmail.net",
  "temp-mail.org",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "getnada.com",
  "getairmail.com",
  "mailnesia.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "tempinbox.com",
  "tempinbox.net",
  "sharklasers.com",
  "grr.la",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.info",
  "spam4.me",
  "bccto.me",
  "chacuo.net",
  "my10minutemail.com",
  "nowmymail.com",
  "tempail.com",
  "tempmail.io",
  "tempmaildemo.com",
  "tmpeml.com",
  "temporarymail.com",
  "fakemailgenerator.com",
  "emailondeck.com",
  "mintemail.com",
  "spambog.com",
  "spambog.de",
  "spambog.ru",
  "mailcatch.com",
  "mailcatch.net",
  "spamfree24.com",
  "spamfree24.de",
  "spamfree24.eu",
  "spamfree24.info",
  "spamfree24.net",
  "spamfree24.org",
  "tmail.ws",
  "tmailer.com",
  "tmailer.net",
  "tmailer.org",
]);

/**
 * Check if an email domain is disposable/temporary
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

/**
 * Check content for spam indicators
 * Returns { isSpam: boolean, reasons: string[] }
 */
export function checkSpamContent(text: string): { isSpam: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const lowerText = text.toLowerCase();

  // Check spam keywords
  for (const keyword of SPAM_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      reasons.push(`Spam keyword: "${keyword}"`);
      score += 2;
      if (reasons.length >= 3) break; // Limit reasons
    }
  }

  // Check suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      if (pattern.source.includes("https")) {
        reasons.push(`Multiple URLs detected (${matches.length})`);
        score += 3;
      } else if (pattern.source.includes("@")) {
        reasons.push(`Email address in message body`);
        score += 1;
      } else if (pattern.source.includes("\\+")) {
        reasons.push(`Phone number in message body`);
        score += 1;
      } else if (pattern.source.includes("[13]")) {
        reasons.push(`Cryptocurrency address detected`);
        score += 5;
      } else if (pattern.source.includes("[A-Z]{4}")) {
        reasons.push(`Excessive capitalization`);
        score += 1;
      } else if (pattern.source.includes("\\1{4}")) {
        reasons.push(`Repeated characters`);
        score += 2;
      }
      if (reasons.length >= 3) break;
    }
  }

  // Check for very short or very long messages
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 750) {
    reasons.push("Message excessively long");
    score += 2;
  }

  // Check for excessive punctuation
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 3) {
    reasons.push("Excessive exclamation marks");
    score += 1;
  }

  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount > 5) {
    reasons.push("Excessive question marks");
    score += 1;
  }

  return {
    isSpam: score >= 5,
    score,
    reasons,
  };
}
