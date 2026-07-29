import { apiDelete, apiGet, apiPost, apiPut } from "@/api/client";
import type { ChildProfile } from "@/auth/auth-context";

// Historical default id: every account created before multi-child support
// wrote its one child to this fixed id. It is not special on the backend
// (nianza-children is keyed by {userId, childId}, so any id works) — it just
// happens to already exist for every pre-existing account, which is what
// lets multi-child support ship with zero data migration.
export const PRIMARY_CHILD_ID = "primary-child";

export type BackendChild = {
  userId: string;
  childId: string;
  childName: string;
  childBirthDate: string;
  sexAtBirth: ChildProfile["sexAtBirth"];
  language: ChildProfile["language"];
  bornEarly?: boolean;
  weeksEarly?: number | null;
  photoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function childPayload(profile: Partial<ChildProfile>) {
  return {
    childName: profile.childName,
    name: profile.childName,
    childBirthDate: profile.childBirthDate,
    birthDate: profile.childBirthDate,
    sexAtBirth: profile.sexAtBirth,
    language: profile.language,
    bornEarly: profile.bornEarly,
    weeksEarly: profile.weeksEarly,
    photoUrl: profile.childPhotoUri || null,
    createdAt: profile.onboardingCompletedAt
  };
}

/** Lists every child on the signed-in account. */
export async function listChildren() {
  const result = await apiGet<{ children: BackendChild[] }>("/children");
  return result.children || [];
}

/** Creates a new child and returns its backend-assigned childId. */
export async function createChild(profile: Partial<ChildProfile>) {
  const result = await apiPost<{ child: BackendChild }>("/children", childPayload(profile));
  return result.child;
}

/** Updates an existing child by id. */
export async function upsertChild(childId: string, profile: ChildProfile) {
  return apiPut<{ child: BackendChild }>(`/children/${encodeURIComponent(childId)}`, childPayload(profile));
}

/** Soft-deletes a child. The backend keeps the row (marks removedAt) so
 * vitals/milestones/vaccine/report history isn't orphaned — it just stops
 * appearing in listChildren(). */
export async function deleteChild(childId: string) {
  return apiDelete<void>(`/children/${encodeURIComponent(childId)}`);
}

/** @deprecated kept for any lingering caller — prefer upsertChild(childId, profile). */
export async function upsertPrimaryChild(profile: ChildProfile) {
  return upsertChild(PRIMARY_CHILD_ID, profile);
}

/** M16 (Family postcards): records that the postcard offer was just shown
 * (accepted or dismissed -- either way, showing it is what should throttle
 * the next one). A partial PUT: cleanChildPayload on the backend only
 * overwrites fields present in the body, so this can't clobber the rest of
 * the child record. */
export async function markPostcardOffered(childId: string) {
  return apiPut<{ child: BackendChild }>(`/children/${encodeURIComponent(childId)}`, {
    lastPostcardOfferAt: new Date().toISOString()
  });
}
