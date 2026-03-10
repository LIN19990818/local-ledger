import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme/colors';

interface PasswordModalProps {
  visible: boolean;
  title: string;
  message?: string;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isError?: boolean;
  errorMessage?: string;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  visible,
  title,
  message,
  onClose,
  onConfirm,
  isError,
  errorMessage
}) => {
  const [password, setPassword] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const handleConfirm = () => {
    if (password.length >= 4) {
      onConfirm(password);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="lock-closed" size={32} color={colors.primary} />
            <Text style={styles.title}>{title}</Text>
            {message && <Text style={styles.message}>{message}</Text>}
          </View>

          <TextInput
            ref={inputRef}
            style={[styles.input, isError && styles.inputError]}
            placeholder="请输入操作密码"
            placeholderTextColor={colors.text.secondary.light}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleConfirm}
          />

          {isError && (
            <Text style={styles.errorText}>{errorMessage || '密码错误'}</Text>
          )}

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={onClose}
            >
              <Text style={styles.buttonCancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonConfirm]}
              onPress={handleConfirm}
            >
              <Text style={styles.buttonConfirmText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    backgroundColor: colors.card.light,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 360
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary.light,
    marginTop: spacing.md
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.text.secondary.light,
    marginTop: spacing.xs,
    textAlign: 'center'
  },
  input: {
    fontSize: fontSize.xl,
    color: colors.text.primary.light,
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    textAlign: 'center',
    letterSpacing: 8
  },
  inputError: {
    borderWidth: 1,
    borderColor: colors.danger
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg
  },
  button: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center'
  },
  buttonCancel: {
    backgroundColor: colors.surface.light
  },
  buttonConfirm: {
    backgroundColor: colors.primary
  },
  buttonCancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary.light
  },
  buttonConfirmText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: '#FFFFFF'
  }
});
