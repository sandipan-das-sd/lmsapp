import { StyleSheet, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Header from "@/components/header/header";
import SearchInput from "@/components/common/search.input";
import HomeBannerSlider from "@/components/home/home.banner.slider";
import AllCourses from "@/components/courses/all.courses";

export default function HomeScreen() {
  const components = [
    { key: "header", component: <Header /> },
    { key: "searchInput", component: <SearchInput homeScreen={true} /> },
    { key: "homeBannerSlider", component: <HomeBannerSlider /> },
    { key: "allCourses", component: <AllCourses /> },
  ];

  return (
    <LinearGradient
      colors={["#E5ECF9", "#F6F7F9"]}
      style={{ flex: 1, paddingTop: 50 }}
    >
      <FlatList
        data={components}
        renderItem={({ item }) => item.component}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
      />
    </LinearGradient>
  );
}

export const styles = StyleSheet.create({});
