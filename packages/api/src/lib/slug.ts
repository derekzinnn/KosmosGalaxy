/**
 * Turn a human title into a URL-safe identifier.
 *
 * "Onboarding — Gestão de Tráfego" becomes "onboarding-gestao-de-trafego".
 * Accents are stripped rather than percent-encoded so the result stays
 * readable in a link, which matters because clients see these.
 */
export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      // Strip the combining marks that NFD just separated out.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '')
  );
}

/**
 * Find the first free variant of `base`, given the slugs already taken.
 * "gestao-de-trafego" then "gestao-de-trafego-2", and so on.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base.length > 0 ? base : 'trilha';
  if (!taken.has(root)) return root;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  // Practically unreachable; a timestamp is still better than a collision.
  return `${root}-${Date.now().toString(36)}`;
}
