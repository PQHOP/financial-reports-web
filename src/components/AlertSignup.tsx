import { alertsEnabled } from "@/lib/alerts";
import { cleanCompanyName } from "@/lib/companyName";
import { AlertSignupForm } from "@/components/AlertSignupForm";

// "Email me when you analyze <company>'s next report". Renders nothing until
// RESEND_API_KEY is set. Safe on ISR pages: it reads only an env var, so the
// page stays static (it picks the form up on its next render after the key
// is added and the site redeployed).
export function AlertSignup({
  ticker,
  companyName,
}: {
  ticker: string;
  companyName: string;
}) {
  if (!alertsEnabled() || !ticker) return null;
  const name = cleanCompanyName(companyName);
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
      <p className="text-zinc-700">
        Get an email when we analyze {name}&apos;s next report. No newsletter,
        one email per report, unsubscribe in one click.
      </p>
      <AlertSignupForm ticker={ticker.toUpperCase()} />
    </section>
  );
}
