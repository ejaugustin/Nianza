import type { ReactElement } from "react";

// NZA-POSTCARDS-v1.0 Section 3: each template is a layout with named slots
// (photoUrl, childName, headline, messageText, dateLine) that real data gets
// dropped into per send -- deterministic assembly, never per-send generation.
export type PostcardSlotProps = {
  photoUri: string | null;
  /** Extra photos for templates that use more than one (Filmstrip). Always
   * includes photoUri as the first/only entry when the parent picked just
   * one -- multi-photo selection isn't wired into the compose flow yet, so
   * these templates gracefully degrade to their single-photo look rather
   * than showing anything broken. */
  photoUris: string[];
  childName: string;
  headline: string;
  messageText: string;
  dateLine: string;
};

export type PostcardTemplateComponent = (props: PostcardSlotProps) => ReactElement;

// Shared "designed once, not app UI chrome" palette additions -- the spec
// explicitly calls out avoiding the app's own rounded-pill/card-shadow
// language here, so these live separately from theme.colors rather than
// reusing screen-spec's component styles.
export const postcardPalette = {
  cream: "#F4F0E8",
  creamDeep: "#E8E0D0",
  ink: "#2A2A28",
  filmDark: "#1D1D1D"
};

export const serifFont = { fontFamily: "Georgia" };
