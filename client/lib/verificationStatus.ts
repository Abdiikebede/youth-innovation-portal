// Utility to check verification status for the current user
export async function getVerificationStatus(userId: string) {
  try {
    const res = await fetch(`/api/verification/check/${userId}`);
    if (!res.ok) return { hasPending: false, isVerified: false };
    return await res.json();
  } catch {
    return { hasPending: false, isVerified: false };
  }
}
