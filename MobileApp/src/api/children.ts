import { apiPut } from "@/api/client";
import type { ChildProfile } from "@/auth/auth-context";

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

export async function upsertPrimaryChild(profile: ChildProfile) {
  return apiPut<{ child: BackendChild }>(`/children/${PRIMARY_CHILD_ID}`, {
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
  });
}
