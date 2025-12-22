import { StyleSheet } from "react-native";

export const formStyles = StyleSheet.create({
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export const resultStyles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  text: {
    fontFamily: "monospace",
    fontSize: 14,
  },
});

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  infoContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
  },
});
