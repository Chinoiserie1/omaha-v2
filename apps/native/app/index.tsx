import { Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserForm } from "./components/UserForm.js";
import { screenStyles } from "./components/styles.js";

export default function HomeScreen() {
  return (
    <SafeAreaView style={screenStyles.container}>
      <ScrollView contentContainerStyle={screenStyles.scrollContent}>
        <Text style={screenStyles.title}>Autopilot - Native App</Text>

        <UserForm />

        <View style={screenStyles.infoContainer}>
          <Text style={screenStyles.infoTitle}>Shared Package Demo</Text>
          <Text style={screenStyles.infoText}>
            This form uses Zod schemas from @repo/shared for validation.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
