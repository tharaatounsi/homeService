/** Transforme une erreur DRF ({champ: [messages]}) en texte lisible. */
export function flattenErrors(err: any): string {
  const body = err?.error;
  if (!body || typeof body !== 'object') {
    return 'Une erreur est survenue. Réessayez.';
  }
  return Object.values(body).flat().join(' ');
}
