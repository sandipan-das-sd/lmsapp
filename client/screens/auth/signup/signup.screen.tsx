import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { CheckBox } from "react-native-elements";
import {
  AntDesign,
  Entypo,
  FontAwesome,
  Fontisto,
  Ionicons,
  SimpleLineIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFonts,
  Raleway_700Bold,
  Raleway_600SemiBold,
} from "@expo-google-fonts/raleway";
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_700Bold,
  Nunito_600SemiBold,
} from "@expo-google-fonts/nunito";
import { useState } from "react";
import { commonStyles } from "@/styles/common/common.styles";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { SERVER_URI } from "@/utils/uri";
import { Toast } from "react-native-toast-notifications";

export default function SignUpScreen() {
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [buttonSpinner, setButtonSpinner] = useState(false);
  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
    password: "",
    phone: "+91",
  });
  const [required, setRequired] = useState("");
  const [error, setError] = useState({
    password: "",
    phone: "",
  });
  const [isTermsChecked, setTermsChecked] = useState(false);

  let [fontsLoaded, fontError] = useFonts({
    Raleway_600SemiBold,
    Raleway_700Bold,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_700Bold,
    Nunito_600SemiBold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const handlePasswordValidation = (value: string) => {
    const password = value;
    const passwordSpecialCharacter = /(?=.*[!@#$&*])/;
    const passwordOneNumber = /(?=.*[0-9])/;
    const passwordSixValue = /(?=.{6,})/;

    if (!passwordSpecialCharacter.test(password)) {
      setError({
        ...error,
        password: "Write at least one special character",
      });
      setUserInfo({ ...userInfo, password: "" });
    } else if (!passwordOneNumber.test(password)) {
      setError({
        ...error,
        password: "Write at least one number",
      });
      setUserInfo({ ...userInfo, password: "" });
    } else if (!passwordSixValue.test(password)) {
      setError({
        ...error,
        password: "Write at least 6 characters",
      });
      setUserInfo({ ...userInfo, password: "" });
    } else {
      setError({
        ...error,
        password: "",
      });
      setUserInfo({ ...userInfo, password: value });
    }
  };

  const handleSignIn = async () => {
    const { name, email, password, phone } = userInfo;
    let valid = true;

    if (!name) {
      setError((prevError) => ({ ...prevError, name: "Name is required" }));
      valid = false;
    }
    if (!email) {
      setError((prevError) => ({ ...prevError, email: "Email is required" }));
      valid = false;
    }
    if (!password) {
      setError((prevError) => ({
        ...prevError,
        password: "Password is required",
      }));
      valid = false;
    }
    if (!phone || phone === "+91") {
      setError((prevError) => ({
        ...prevError,
        phone: "Phone number is required",
      }));
      valid = false;
    }

    if (!valid) {
      Toast.show("Please fill all the required fields", {
        type: "danger",
      });
      return;
    }

    if (!isTermsChecked) {
      Toast.show("Please agree to the Terms & Conditions to proceed.", {
        type: "danger",
      });
      return;
    }
    setButtonSpinner(true);
    await axios
      .post(`${SERVER_URI}/registration`, {
        name: userInfo.name,
        email: userInfo.email,
        password: userInfo.password,
        phone: userInfo.phone,
      })
      .then(async (res) => {
        await AsyncStorage.setItem(
          "activation_token",
          res.data.activationToken
        );
        Toast.show(res.data.message, {
          type: "success",
        });
        setUserInfo({
          name: "",
          email: "",
          password: "",
          phone: "+91",
        });
        setButtonSpinner(false);
        router.push("/(routes)/verifyAccount");
      })
      .catch((error) => {
        setButtonSpinner(false);
        Toast.show("Email already exists!", {
          type: "danger",
        });
      });
  };

  const handlePhoneNumberChange = (value: string) => {
    setUserInfo({ ...userInfo, phone: value });
  };

  const handlePhoneNumberValidation = () => {
    const phoneNumber = userInfo.phone.replace("+91", "");
    if (phoneNumber.length !== 10) {
      setError({
        ...error,
        phone: "Phone number must be 10 digits",
      });
      setUserInfo({ ...userInfo, phone: "" });
    } else {
      setError({
        ...error,
        phone: "",
      });
      setUserInfo({ ...userInfo, phone: userInfo.phone });
    }
  };
  return (
    <LinearGradient
      colors={["#E5ECF9", "#F6F7F9"]}
      style={{ flex: 1, paddingTop: 20 }}
    >
      <ScrollView>
        <Image
          style={styles.signInImage}
          source={require("@/assets/sign-in/signup.png")}
        />
        <Text style={[styles.welcomeText, { fontFamily: "Raleway_700Bold" }]}>
          Let's get started!
        </Text>
        <Text style={styles.learningText}>Create an account to SolviT</Text>
        <View style={styles.inputContainer}>
          <View>
            <TextInput
              style={[styles.input, { paddingLeft: 40, marginBottom: -12 }]}
              keyboardType="default"
              value={userInfo.name}
              placeholder="Enter your name.."
              onChangeText={(value) =>
                setUserInfo({ ...userInfo, name: value })
              }
            />
            <AntDesign
              style={{ position: "absolute", left: 26, top: 14 }}
              name="user"
              size={20}
              color={"#A1A1A1"}
            />
          </View>
          <View>
            <TextInput
              style={[styles.input, { paddingLeft: 40 }]}
              keyboardType="email-address"
              value={userInfo.email}
              placeholder="example@email.com"
              onChangeText={(value) =>
                setUserInfo({ ...userInfo, email: value })
              }
            />
            <Fontisto
              style={{ position: "absolute", left: 26, top: 17.8 }}
              name="email"
              size={20}
              color={"#A1A1A1"}
            />
            {required && (
              <View style={commonStyles.errorContainer}>
                <Entypo name="cross" size={18} color={"red"} />
              </View>
            )}
            <View style={{ marginTop: 15 }}>
              <TextInput
                style={commonStyles.input}
                keyboardType="default"
                secureTextEntry={!isPasswordVisible}
                defaultValue=""
                placeholder="Enter password..."
                onChangeText={handlePasswordValidation}
              />
              <TouchableOpacity
                style={styles.visibleIcon}
                onPress={() => setPasswordVisible(!isPasswordVisible)}
              >
                {isPasswordVisible ? (
                  <Ionicons name="eye-outline" size={23} color={"#747474"} />
                ) : (
                  <Ionicons
                    name="eye-off-outline"
                    size={23}
                    color={"#747474"}
                  />
                )}
              </TouchableOpacity>
              <SimpleLineIcons
                style={styles.icon2}
                name="lock"
                size={20}
                color={"#A1A1A1"}
              />
            </View>
            {error.password && (
              <View style={[commonStyles.errorContainer, { top: 125 }]}>
                <Entypo name="cross" size={18} color={"red"} />
                <Text style={{ color: "red", fontSize: 11, marginTop: -1 }}>
                  {error.password}
                </Text>
              </View>
            )}
            <View style={{ marginTop: 15 }}>
              <TextInput
                style={commonStyles.input}
                keyboardType="phone-pad"
                value={userInfo.phone}
                placeholder="Enter your phone number..."
                onChangeText={handlePhoneNumberChange}
                onBlur={handlePhoneNumberValidation}
              />
              <SimpleLineIcons
                style={styles.icon2}
                name="phone"
                size={20}
                color={"#A1A1A1"}
              />
            </View>
            {error.phone && (
              <View style={[commonStyles.errorContainer, { top: 195 }]}>
                <Entypo name="cross" size={18} color={"red"} />
                <Text style={{ color: "red", fontSize: 11, marginTop: -1 }}>
                  {error.phone}
                </Text>
              </View>
            )}

            <View style={styles.checkboxContainer}>
              <CheckBox
                checked={isTermsChecked}
                onPress={() => setTermsChecked(!isTermsChecked)}
              />
              <TouchableOpacity onPress={() => router.push("/(routes)/terms")}>
                <Text style={styles.checkboxText}>
                  I agree to the Terms & Conditions
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignIn}
            >
              {buttonSpinner ? (
                <ActivityIndicator size="small" color={"white"} />
              ) : (
                <Text style={styles.signupButtonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <View style={styles.socialLoginContainer}>
              <TouchableOpacity>
                <FontAwesome name="google" size={30} />
              </TouchableOpacity>
              <TouchableOpacity>
                <FontAwesome name="facebook" size={30} />
              </TouchableOpacity>
            </View>

            <View style={styles.signupRedirect}>
              <Text style={{ fontSize: 18, fontFamily: "Raleway_600SemiBold" }}>
                Already have an account?
              </Text>
              <TouchableOpacity onPress={() => router.push("/(routes)/login")}>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: "Raleway_600SemiBold",
                    color: "#2467EC",
                    marginLeft: 5,
                  }}
                >
                  Login
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  signInImage: {
    width: "60%",
    height: 250,
    alignSelf: "center",
    marginTop: 4,
  },
  welcomeText: {
    textAlign: "center",
    fontSize: 24,
  },
  learningText: {
    textAlign: "center",
    color: "#575757",
    fontSize: 15,
    marginTop: 5,
  },
  inputContainer: {
    marginHorizontal: 16,
    marginTop: 30,
    rowGap: 30,
  },
  input: {
    height: 55,
    marginHorizontal: 16,
    borderRadius: 8,
    paddingLeft: 35,
    fontSize: 16,
    backgroundColor: "white",
    color: "#1A1A1A",
  },
  visibleIcon: {
    position: "absolute",
    right: 30,
    top: 15,
  },
  icon2: {
    position: "absolute",
    left: 23,
    top: 17.8,
    marginTop: -2,
  },
  forgotSection: {
    marginHorizontal: 16,
    textAlign: "right",
    fontSize: 16,
    marginTop: 10,
  },
  signupRedirect: {
    flexDirection: "row",
    marginHorizontal: 16,
    justifyContent: "center",
    marginBottom: 20,
    marginTop: 20,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  checkboxText: {
    marginLeft: -8,
    fontSize: 14,
    color: "#2467EC",
  },
  signupButton: {
    padding: 16,
    borderRadius: 50,
    marginHorizontal: 50,
    backgroundColor: "#2467EC",
    marginTop: 15,
  },
  signupButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Raleway_700Bold",
  },
  socialLoginContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 20,
  },
  termsText: {
    fontSize: 14,
    color: "#2467EC",
    marginLeft: 5,
  },
});
