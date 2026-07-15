import { ReactNode } from "react";
import {
  Modal,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { styles } from "@/constants/theme";

type Props = {
  visible: boolean;
  onRequestClose?: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
};

export function KeyboardModal({
  visible,
  onRequestClose,
  children,
  sheetStyle,
  scroll = true,
}: Props) {
  const content = scroll ? (
    <ScrollView
      style={[styles.modalSheet, sheetStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.modalHandle} />
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.modalSheet, sheetStyle]}>
      <View style={styles.modalHandle} />
      {children}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
      >
        {content}
      </KeyboardAvoidingView>
    </Modal>
  );
}
