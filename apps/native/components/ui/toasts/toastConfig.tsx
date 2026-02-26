import type { ToastConfig } from "react-native-toast-message";
import { GlassToast } from "./GlassToast";

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => (
    <GlassToast type="success" text1={text1} text2={text2} />
  ),
  error: ({ text1, text2 }) => (
    <GlassToast type="error" text1={text1} text2={text2} />
  ),
};
