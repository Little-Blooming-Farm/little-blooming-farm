import { useEffect, useState } from 'react';

/**
 * Apple Pay / Google Pay prominence.
 *
 * The payment itself happens on Stripe's hosted Checkout, which renders the
 * wallet button full-width above the card form whenever the device supports it.
 * What this component does is make that visible *before* the guest commits —
 * "one tap, no card details" is the reason a lot of people finish a booking on
 * a phone at all, and it should not be a surprise discovered after the redirect.
 *
 * Detection is real, not assumed: `window.ApplePaySession` exists only on
 * Safari/Apple hardware that can actually pay, so the Apple mark is shown only
 * to people who can use it, and everyone else sees the accurate generic line.
 */
export function useWalletSupport() {
  const [support, setSupport] = useState({ apple: false, google: false, checked: false });

  useEffect(() => {
    // `canMakePayments()` is synchronous and does not prompt; it reports whether
    // the device has the capability, not whether a card is set up (which would
    // require a merchant session we cannot create from our own origin).
    const apple =
      typeof window !== 'undefined' &&
      typeof window.ApplePaySession !== 'undefined' &&
      (() => {
        try {
          return window.ApplePaySession.canMakePayments();
        } catch {
          return false;
        }
      })();

    // Chrome/Android. Deliberately loose — this only decides which words to
    // show, and Stripe makes the real decision at Checkout.
    const google =
      typeof window !== 'undefined' &&
      /Chrome|CriOS/.test(navigator.userAgent) &&
      !/Edge/.test(navigator.userAgent);

    setSupport({ apple: Boolean(apple), google: Boolean(google), checked: true });
  }, []);

  return support;
}

function AppleMark({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.53a4.2 4.2 0 0 1 2.02-3.53 4.34 4.34 0 0 0-3.42-1.85c-1.44-.15-2.83.85-3.57.85-.74 0-1.88-.83-3.09-.81a4.55 4.55 0 0 0-3.83 2.33c-1.64 2.84-.42 7.05 1.18 9.36.78 1.13 1.71 2.4 2.93 2.35 1.18-.05 1.62-.76 3.05-.76 1.42 0 1.83.76 3.07.73 1.27-.02 2.07-1.15 2.85-2.28a9.3 9.3 0 0 0 1.29-2.64 4.07 4.07 0 0 1-2.48-3.75ZM14.7 5.68A4.13 4.13 0 0 0 15.66 2a4.22 4.22 0 0 0-2.76 1.43 3.93 3.93 0 0 0-.99 3.55 3.49 3.49 0 0 0 2.79-1.3Z" />
    </svg>
  );
}

/**
 * The full-width reassurance block shown beside a payment button.
 * `tone="dark"` for use on the moss/photographic backgrounds.
 */
export default function WalletBadge({ className = '', tone = 'light', compact = false }) {
  const { apple, google, checked } = useWalletSupport();

  // Nothing at all until detection has run, so the layout does not flicker
  // between two different claims.
  if (!checked) return null;

  const border = tone === 'dark' ? 'border-bloom-100/25' : 'border-bloom-300';
  const text = tone === 'dark' ? 'text-bloom-100/85' : 'text-ink-soft';
  const muted = tone === 'dark' ? 'text-bloom-100/55' : 'text-ink-muted';

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-2 ${text} ${className}`}>
        {apple && <AppleMark className="h-4 w-4" />}
        <span className="font-sans text-[12px] font-light">
          {apple ? 'Apple Pay accepted' : google ? 'Google Pay accepted' : 'Apple Pay & Google Pay accepted'}
        </span>
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-4 border ${border} px-5 py-4 ${className}`}>
      {apple ? (
        <AppleMark className={`h-7 w-7 shrink-0 ${text}`} />
      ) : (
        <svg
          viewBox="0 0 24 24"
          className={`h-6 w-6 shrink-0 ${text}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      )}
      <div className="min-w-0">
        <p className={`font-sans text-[14px] ${text}`}>
          {apple
            ? 'Pay with Apple Pay — one tap, no card details'
            : google
              ? 'Pay with Google Pay — one tap, no card details'
              : 'Apple Pay, Google Pay and all major cards'}
        </p>
        <p className={`mt-0.5 font-sans text-[12px] font-light ${muted}`}>
          {apple || google
            ? 'It appears first on the payment page. Cards are welcome too.'
            : 'Wallet payment appears automatically on supported devices.'}
        </p>
      </div>
    </div>
  );
}
