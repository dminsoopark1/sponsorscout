export function EnvNotice({ reason }: { reason: 'missing' | 'service-role' }) {
  return (
    <section className="authcard">
      <h1>Supabase is not ready</h1>
      {reason === 'service-role' ? (
        <p className="authlead">
          The browser key is a secret key. Remove it from the Next.js environment, use the publishable key, and rotate that secret in Supabase if it was ever placed in a <code>NEXT_PUBLIC_</code> variable.
        </p>
      ) : (
        <p className="authlead">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then restart the dev server. Guest offer analysis still works without them.
        </p>
      )}
    </section>
  );
}
