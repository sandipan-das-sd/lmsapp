import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFonts,
  Raleway_600SemiBold,
  Raleway_700Bold,
} from "@expo-google-fonts/raleway";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import useUser from "@/hooks/auth/useUser";
import axios from "axios";
import { SERVER_URI } from "@/utils/uri";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ProfileDetailsScreen() {
  const { user, setRefetch } = useUser();
  const [name, setName] = useState(user?.name || "");
  const [loading, setLoading] = useState(false);

  let [fontsLoaded, fontError] = useFonts({
    Raleway_600SemiBold,
    Raleway_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const updateProfileHandler = async () => {
    setLoading(true);
    try {
      const accessToken = await AsyncStorage.getItem("access_token");
      const refreshToken = await AsyncStorage.getItem("refresh_token");

      const response = await axios.put(
        `${SERVER_URI}/update-user-profile`,
        {
          name: name,
        },
        {
          headers: {
            "access-token": accessToken,
            "refresh-token": refreshToken,
          },
        }
      );
      if (response.data) {
        setRefetch(true);
        setLoading(false);
        router.back(); // Go back to the previous screen
      }
    } catch (error) {
      setLoading(false);
      console.log(error);
    }
  };

  return (
    <LinearGradient
      colors={["#E5ECF9", "#F6F7F9"]}
      style={{ flex: 1, paddingTop: 80 }}
    >
      <View style={styles.container}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(text) => setName(text)}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: "#e0e0e0" }]}
          value={user?.email}
          editable={false}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: "#e0e0e0" }]}
          value={user?.phone}
          editable={false}
        />

        <TouchableOpacity
          style={styles.updateButton}
          onPress={updateProfileHandler}
        >
          <Text style={styles.updateButtonText}>
            {loading ? "Updating..." : "Update Profile"}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 18,
    fontFamily: "Nunito_700Bold",
    marginBottom: 8,
  },
  input: {
    height: 55,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "white",
    color: "#1A1A1A",
    marginBottom: 20,
  },
  updateButton: {
    padding: 16,
    borderRadius: 50,
    backgroundColor: "#2467EC",
    alignItems: "center",
    marginTop: 20,
  },
  updateButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Raleway_700Bold",
  },
});
