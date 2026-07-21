export function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";

  if (message.includes("User is not confirmed")) return "Check your email for the confirmation code before signing in.";
  if (message.includes("Incorrect username or password")) return "That email or password is not right. Try again.";
  if (message.includes("Password did not conform")) return "Use at least 10 characters, including uppercase, lowercase, and a number.";
  if (message.includes("UsernameExistsException")) return "That email already has a Nianza account. Try signing in.";
  if (message.includes("Invalid verification code")) return "That confirmation code is not right. Try the latest code from your email.";
  if (message.includes("not configured")) return "Mobile sign-in is waiting on the Cognito environment values.";

  return message;
}
