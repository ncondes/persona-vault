// Revokes an OIDC grant and the tokens issued under it, cutting an app's access.
// `provider` is the oidc-provider instance (ESM type, kept loose here).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function revokeGrant(provider: any, grantId: string): Promise<void> {
  await Promise.all([
    provider.AccessToken.revokeByGrantId(grantId),
    provider.RefreshToken.revokeByGrantId(grantId),
    provider.Grant.adapter.destroy(grantId),
  ]);
}
