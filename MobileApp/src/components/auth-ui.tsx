import { ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, PressableProps, Text, TextInput, View } from "react-native";
import { SfIcon } from "@/components/screen-spec";
import { theme } from "@/theme/theme";

export function AuthButton({
  children,
  disabled,
  loading,
  onPress,
  variant = "primary",
  ...pressableProps
}: PressableProps & {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "text";
}) {
  const isPrimary = variant === "primary";
  const isText = variant === "text";
  return (
    <Pressable
      accessibilityRole="button"
      {...pressableProps}
      disabled={disabled || loading}
      onPress={onPress}
      style={{
        minHeight: isText ? 28 : 52,
        borderRadius: isText ? 0 : theme.radii.control,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isText ? "transparent" : disabled ? theme.colors.border : isPrimary ? theme.colors.bluePrimary : "white",
        borderWidth: isText || isPrimary ? 0 : 1.5,
        borderColor: theme.colors.bluePrimary,
        opacity: disabled ? 0.7 : 1
      }}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "white" : theme.colors.bluePrimary} />
      ) : (
        <Text selectable style={{ color: isPrimary ? "white" : theme.colors.bluePrimary, fontSize: isText ? 14 : 16, fontWeight: "700" }}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = "default"
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <View
        style={{
          minHeight: 52,
          borderRadius: theme.radii.control,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: "white",
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 14,
          paddingRight: isPassword ? 8 : 14
        }}
      >
        <TextInput
          autoCapitalize="none"
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.greyIcon}
          returnKeyType="next"
          secureTextEntry={isPassword && !passwordVisible}
          value={value}
          onChangeText={onChangeText}
          style={{
            flex: 1,
            minHeight: 52,
            color: theme.colors.text,
            fontSize: 15
          }}
        />
        {isPassword ? (
          <Pressable accessibilityLabel={passwordVisible ? "Hide password" : "Show password"} accessibilityRole="button" onPress={() => setPasswordVisible((current) => !current)} style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }}>
            <SfIcon name={passwordVisible ? "eye.slash" : "eye"} color={theme.colors.greyIcon} size={22} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function AuthError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={{ borderRadius: 12, backgroundColor: "#FCECEC", borderWidth: 1, borderColor: theme.colors.error, padding: 12 }}>
      <Text selectable style={{ color: theme.colors.error, fontSize: 13, lineHeight: 18 }}>{message}</Text>
    </View>
  );
}
